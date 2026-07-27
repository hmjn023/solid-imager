import { prepareJob } from "@solid-imager/core/domain/jobs/registry";
import { createMediaSourceRevision } from "@solid-imager/core/domain/media/revision";
import type {
	Job,
	NewJob,
} from "@solid-imager/core/domain/repositories/job-repository";
import { and, asc, eq, gt, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { services } from "~/application/registry";
import { taggingService } from "~/application/services/tagging-service";
import { db } from "~/infrastructure/db";
import {
	jobs,
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
} from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

type ExecutableJob = Pick<
	Job,
	| "id"
	| "type"
	| "mediaSourceId"
	| "status"
	| "payload"
	| "result"
	| "error"
	| "createdAt"
	| "updatedAt"
	| "parentId"
>;

const autoTaggingPayloadSchema = z.object({
	mediaId: z.string(),
	force: z.boolean().optional(),
});

const bulkTaggingDispatchPayloadSchema = z.object({
	force: z.boolean().optional(),
	batchSize: z.number().optional(),
	mediaSourceId: z.string().optional(),
});

export async function processAutoTaggingJob(
	job: ExecutableJob,
	signal?: AbortSignal,
): Promise<void> {
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
				signal,
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

	} catch (error) {
		logger.error({ err: error, mediaId }, "Auto tagging failed");
		throw error;
	}
}

export async function processBulkTaggingDispatchJob(
	job: ExecutableJob,
): Promise<void> {
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
				modifiedAt: medias.modifiedAt,
				fileSize: medias.fileSize,
				width: medias.width,
				height: medias.height,
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

		const jobRows: NewJob[] = await Promise.all(
			results.map(async (row) => ({
				type: "auto_tagging",
				mediaSourceId: row.mediaSourceId,
				parentId,
				targetId: row.id,
				inputRevision: await createMediaSourceRevision({
					mediaId: row.id,
					mediaSourceId: row.mediaSourceId,
					modifiedAt: row.modifiedAt,
					fileSize: row.fileSize,
					width: row.width,
					height: row.height,
				}),
				payload: {
					mediaId: row.id,
					force,
				},
			})),
		);
		for (let i = 0; i < jobRows.length; i += CHILD_INSERT_CHUNK) {
			const chunk = jobRows.slice(i, i + CHILD_INSERT_CHUNK);
			await db.insert(jobs).values(chunk.map(prepareJob)).onConflictDoNothing();
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
	const progress = await jobRepo.recomputeBatchProgress(parentId);
	const totalChildCount = progress?.total ?? 0;

	if (totalChildCount === 0) {
		await jobRepo.update(parentId, { status: "completed" });
		RealtimeEventBus.publishJob("job-completed", {
			jobId: parentId,
			message: "Batch tagging completed (no targets)",
		});
	} else {
		RealtimeEventBus.publishJob("job-progress", {
			jobId: parentId,
			processed: progress?.processed ?? 0,
			total: totalChildCount,
		});
	}

	logger.info(
		{ jobId: job.id, parentId, dispatchedCount },
		"Bulk tagging dispatch completed",
	);
}
