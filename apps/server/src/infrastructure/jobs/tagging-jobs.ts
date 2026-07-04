import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import { and, asc, eq, gt, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import {
	type Job,
	jobs,
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
	type NewJob,
} from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

const autoTaggingPayloadSchema = z.object({
	mediaId: z.string(),
	force: z.boolean().optional(),
});

const bulkTaggingDispatchPayloadSchema = z.object({
	force: z.boolean().optional(),
	batchSize: z.number().optional(),
	mediaSourceId: z.string().optional(),
});

async function finalizeBatchParent(
	parentId: string,
	progress: { processed: number; failed: number; total: number },
): Promise<void> {
	const jobRepo = services.getJobRepository();
	if (progress.failed > 0) {
		await jobRepo.update(parentId, { status: "failed" });
		RealtimeEventBus.publishJob("job-failed", {
			jobId: parentId,
			error: `${progress.failed} child job(s) failed`,
		});
		return;
	}
	await jobRepo.update(parentId, { status: "completed" });
	RealtimeEventBus.publishJob("job-completed", {
		jobId: parentId,
		message: "Batch tagging completed",
	});
}

export async function processAutoTaggingJob(job: Job): Promise<void> {
	const payload = autoTaggingPayloadSchema.parse(job.payload);
	const { mediaId, force } = payload;
	const { mediaSourceId, parentId } = job;

	if (!(mediaId && mediaSourceId)) {
		throw new Error("Missing mediaId or mediaSourceId");
	}

	try {
		const result = await taggingService.getTagsForMedia(
			mediaSourceId,
			mediaId,
			{
				skipCache: force,
			},
		);
		logger.info(
			{
				jobId: job.id,
				parentId,
				mediaSourceId,
				mediaId,
				force: force ?? false,
				tagCount: result ? Object.keys(result.general).length : 0,
				characterCount: result ? Object.keys(result.character).length : 0,
				ipCount: result?.ips.length ?? 0,
			},
			"Auto tagging completed",
		);
		await services.getJobRepository().createIfUnique({
			type: "sync_lancedb_delta",
			mediaSourceId,
			payload: { reason: "auto_tagging", mediaIds: [mediaId] },
		});

		if (parentId) {
			const jobRepo = services.getJobRepository();
			const progress = await jobRepo.incrementProgress(parentId, job.id);
			if (!progress) {
				return;
			}

			RealtimeEventBus.publishJob("job-progress", {
				jobId: parentId,
				processed: progress.processed,
				total: progress.total,
			});

			if (progress.processed + progress.failed >= progress.total) {
				await finalizeBatchParent(parentId, progress);
			}
		}
	} catch (error) {
		logger.error({ err: error, mediaId }, "Auto tagging failed");
		if (parentId) {
			const jobRepo = services.getJobRepository();
			const progress = await jobRepo.incrementFailedCount(parentId, job.id);
			if (progress) {
				RealtimeEventBus.publishJob("job-progress", {
					jobId: parentId,
					processed: progress.processed,
					total: progress.total,
				});
				if (progress.processed + progress.failed >= progress.total) {
					await finalizeBatchParent(parentId, progress);
				}
			}
		}
		throw error;
	}
}

export async function processBulkTaggingDispatchJob(job: Job): Promise<void> {
	const payload = bulkTaggingDispatchPayloadSchema.parse(job.payload);
	const force = payload?.force ?? false;
	const batchSize = payload?.batchSize ?? 1000;
	const mediaSourceId = payload?.mediaSourceId;

	if (!job.parentId) {
		throw new Error("bulk_tagging_dispatch requires parentId");
	}
	const parentId = job.parentId;

	logger.info(
		{ jobId: job.id, parentId, mediaSourceId, force, batchSize },
		"Starting bulk tagging dispatch job",
	);

	// Find images
	// Logic: media_type = 'image' AND (source_id = ? IF set) AND (force OR NOT (EXISTS(AI tags) OR EXISTS(AI chars) OR EXISTS(AI IPs)))
	const whereClause = and(
		eq(medias.mediaType, "image"),
		mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
		force
			? undefined
			: and(
					notExists(
						db
							.select()
							.from(mediaTags)
							.where(
								and(
									eq(mediaTags.mediaId, medias.id),
									eq(mediaTags.source, "AI"),
								),
							),
					),
					notExists(
						db
							.select()
							.from(mediaCharacters)
							.where(
								and(
									eq(mediaCharacters.mediaId, medias.id),
									eq(mediaCharacters.source, "AI"),
								),
							),
					),
					notExists(
						db
							.select()
							.from(mediaIps)
							.where(
								and(eq(mediaIps.mediaId, medias.id), eq(mediaIps.source, "AI")),
							),
					),
				),
	);

	const existingChild = db
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				eq(jobs.parentId, parentId),
				eq(jobs.type, "auto_tagging"),
				sql`${jobs.payload}->>'mediaId' = ${medias.id}`,
			),
		);
	const whereWithDedupe = and(whereClause, notExists(existingChild));

	let lastSeenId: string | null = null;
	let dispatchedCount = 0;
	const CHILD_INSERT_CHUNK = 500;

	while (true) {
		const results = await db
			.select({
				id: medias.id,
				mediaSourceId: medias.mediaSourceId,
			})
			.from(medias)
			.where(
				and(
					whereWithDedupe,
					lastSeenId ? gt(medias.id, lastSeenId) : undefined,
				),
			)
			.orderBy(asc(medias.id))
			.limit(batchSize);

		if (results.length === 0) {
			if (dispatchedCount === 0) {
				logger.info(
					{ jobId: job.id, parentId, mediaSourceId, force },
					"No matching images found for bulk tagging",
				);
			}
			break;
		}

		const jobRows: NewJob[] = results.map((row) => ({
			type: "auto_tagging",
			mediaSourceId: row.mediaSourceId,
			parentId,
			payload: {
				mediaId: row.id,
				force,
			},
		}));
		for (let i = 0; i < jobRows.length; i += CHILD_INSERT_CHUNK) {
			const chunk = jobRows.slice(i, i + CHILD_INSERT_CHUNK);
			await db.insert(jobs).values(chunk);
		}

		dispatchedCount += results.length;
		lastSeenId = results[results.length - 1].id;

		logger.info(
			{
				jobId: job.id,
				parentId,
				dispatchedCount,
			},
			"Bulk tagging dispatch progress",
		);
	}

	const jobRepo = services.getJobRepository();
	const parentJob = await jobRepo.findById(parentId);
	const parentPayload = batchParentPayloadSchema.parse(parentJob?.payload ?? {});
	await jobRepo.update(parentId, {
		payload: { ...parentPayload, total: dispatchedCount },
	});

	RealtimeEventBus.publishJob("job-progress", {
		jobId: parentId,
		processed: 0,
		total: dispatchedCount,
	});

	logger.info(
		{ jobId: job.id, parentId, dispatchedCount },
		"Bulk tagging dispatch completed",
	);
}
