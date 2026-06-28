import { getErrorMessage } from "@solid-imager/core/utils";
import { and, asc, eq, notExists } from "drizzle-orm";
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

export async function processAutoTaggingJob(job: Job): Promise<void> {
	const payload = autoTaggingPayloadSchema.parse(job.payload);
	const { mediaId, force } = payload;
	const { mediaSourceId, parentId } = job;

	if (!(mediaId && mediaSourceId)) {
		throw new Error("Missing mediaId or mediaSourceId");
	}

	try {
		await taggingService.getTagsForMedia(mediaSourceId, mediaId, {
			skipCache: force,
		});
		await services.getJobRepository().createIfUnique({
			type: "sync_lancedb_delta",
			mediaSourceId,
			payload: { reason: "auto_tagging", mediaIds: [mediaId] },
		});

		if (parentId) {
			const jobRepo = services.getJobRepository();
			const updated = await jobRepo.incrementProgress(parentId, job.id);
			if (!updated) {
				return;
			}
			const parentJob = await jobRepo.findById(parentId);

			if (parentJob) {
				const parentPayloadSchema = z.object({
					total: z.number(),
					processed: z.number(),
					processedJobIds: z.array(z.string().uuid()).optional(),
				});
				try {
					const parentPayload = parentPayloadSchema.parse(parentJob.payload);

					// Publish typed job progress.
					RealtimeEventBus.publishJob("job-progress", {
						jobId: parentId,
						processed: parentPayload.processed,
						total: parentPayload.total,
					});

					if (
						parentJob.status !== "failed" &&
						parentPayload.processed >= parentPayload.total
					) {
						await jobRepo.markAsCompleted(parentId);
						RealtimeEventBus.publishJob("job-completed", {
							jobId: parentId,
						});
					}
				} catch (e) {
					logger.error(
						{ parentId, payload: parentJob.payload, error: e },
						"Invalid parent job payload",
					);
					return;
				}
			}
		}
	} catch (error) {
		logger.error({ err: error, mediaId }, "Auto tagging failed");
		if (parentId) {
			await services.getJobRepository().update(parentId, { status: "failed" });
			RealtimeEventBus.publishJob("job-failed", {
				jobId: parentId,
				error: getErrorMessage(error),
			});
		}
		throw error;
	}
}

export async function processBulkTaggingDispatchJob(job: Job): Promise<void> {
	const payload = bulkTaggingDispatchPayloadSchema.parse(job.payload);
	const force = payload?.force ?? false;
	const batchSize = payload?.batchSize ?? 1000;
	const mediaSourceId = payload?.mediaSourceId;

	logger.info(
		{ jobId: job.id, mediaSourceId, force, batchSize },
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

	let offset = 0;
	let processedCount = 0;

	while (true) {
		const results = await db
			.select({
				id: medias.id,
				mediaSourceId: medias.mediaSourceId,
			})
			.from(medias)
			.where(whereClause)
			.orderBy(asc(medias.id))
			.limit(batchSize)
			.offset(offset);

		if (results.length === 0) {
			if (processedCount === 0) {
				logger.info(
					{ jobId: job.id, mediaSourceId, force },
					"No matching images found for bulk tagging",
				);
			}
			break;
		}

		// Create jobs (bulk insert with batch chunking)
		const jobRows: NewJob[] = results.map((row) => ({
			type: "auto_tagging",
			mediaSourceId: row.mediaSourceId,
			payload: {
				mediaId: row.id,
				mediaSourceId: row.mediaSourceId,
				force,
			},
		}));
		if (jobRows.length === 0) continue;
		const BATCH_SIZE = 500;
		for (let i = 0; i < jobRows.length; i += BATCH_SIZE) {
			const chunk = jobRows.slice(i, i + BATCH_SIZE);
			await db.insert(jobs).values(chunk);
		}

		processedCount += results.length;
		offset += batchSize;

		// Log progress
		logger.info(
			{ jobId: job.id, processedCount },
			"Bulk tagging dispatch progress",
		);
	}

	logger.info(
		{ jobId: job.id, processedCount },
		"Bulk tagging dispatch completed",
	);
}
