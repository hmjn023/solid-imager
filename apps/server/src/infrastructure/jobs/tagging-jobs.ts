import { and, asc, eq, gt, inArray, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/infrastructure/db";
import type { Job } from "@solid-imager/core/jobs";
import {
	jobs,
	mediaCharacters,
	mediaIps,
	medias,
	mediaSources,
	mediaTags,
	type NewJob,
} from "~/infrastructure/db/schema";
import { notifyJob } from "~/infrastructure/events/state-notifications";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { taggingService } from "~/infrastructure/services/tagging-service";

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
	const status = await jobRepo.finishBatch(parentId);
	if (!status) return;
	if (status === "failed") {
		notifyJob("job-failed", {
			jobId: parentId,
			error: `${progress.failed} batch item(s) failed`,
		});
	} else if (status === "completed") {
		notifyJob("job-completed", {
			jobId: parentId,
			message: "Batch completed",
		});
	}
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
		if (parentId) {
			const jobRepo = services.getJobRepository();
			const progress = await jobRepo.recordBatchChildOutcome(
				parentId,
				job.id,
				job.attemptCount ?? 0,
				1,
				0,
			);
			if (!progress || progress.total === 0) {
				return;
			}

			notifyJob("job-progress", {
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
			const progress = await jobRepo.recordBatchChildOutcome(
				parentId,
				job.id,
				job.attemptCount ?? 0,
				0,
				1,
			);
			if (progress && progress.total > 0) {
				notifyJob("job-progress", {
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

/** Queues tagging jobs for eligible media and publishes the parent total after counting its queued children. */
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

	// Videos use their representative thumbnail for the same AI tagging flow.
	const whereClause = and(
		inArray(medias.mediaType, ["image", "video"]),
		eq(mediaSources.type, "local"),
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
				sql`(${jobs.payload}->>'mediaId')::uuid = ${medias.id}`,
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
			.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
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
					"No matching media found for bulk tagging",
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
	const [{ count: rawTotalChildCount }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(jobs)
		.where(and(eq(jobs.parentId, parentId), eq(jobs.type, "auto_tagging")));
	const totalChildCount = Number(rawTotalChildCount ?? 0);
	const progress = await jobRepo.setBatchTotal(parentId, totalChildCount);

	if (totalChildCount === 0) {
		await finalizeBatchParent(parentId, { processed: 0, failed: 0, total: 0 });
	} else {
		notifyJob("job-progress", {
			jobId: parentId,
			processed: progress.processed,
			total: totalChildCount,
		});
		if (progress.processed + progress.failed >= progress.total) {
			await finalizeBatchParent(parentId, progress);
		}
	}

	logger.info(
		{ jobId: job.id, parentId, dispatchedCount },
		"Bulk tagging dispatch completed",
	);
}
