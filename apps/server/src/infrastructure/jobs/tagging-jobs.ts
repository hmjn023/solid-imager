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
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";

type AutoTaggingJobPayload = {
	mediaId: string;
	force?: boolean;
};

type BulkTaggingDispatchJobPayload = {
	force?: boolean;
	batchSize?: number;
	mediaSourceId?: string;
};

export async function processAutoTaggingJob(job: Job): Promise<void> {
	const payload = job.payload as AutoTaggingJobPayload;
	const { mediaId, force } = payload;
	const { mediaSourceId, parentId } = job;
	const JOB_EVENTS_CHANNEL = "global-jobs";

	if (!(mediaId && mediaSourceId)) {
		throw new Error("Missing mediaId or mediaSourceId");
	}

	try {
		await taggingService.getTagsForMedia(mediaSourceId, mediaId, {
			skipCache: force,
		});

		if (parentId) {
			const jobRepo = services.getJobRepository();
			await jobRepo.incrementProgress(parentId);
			const parentJob = await jobRepo.findById(parentId);

			if (parentJob) {
				const parentPayloadSchema = z.object({
					total: z.number(),
					processed: z.number(),
				});
				try {
					const parentPayload = parentPayloadSchema.parse(parentJob.payload);

					// SSE event
					SseManager.sendEvent(JOB_EVENTS_CHANNEL, "job-progress", {
						jobId: parentId,
						processed: parentPayload.processed,
						total: parentPayload.total,
					});

					if (parentPayload.processed >= parentPayload.total) {
						await jobRepo.update(parentId, { status: "completed" });
						SseManager.sendEvent(JOB_EVENTS_CHANNEL, "job-completed", {
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
			SseManager.sendEvent(JOB_EVENTS_CHANNEL, "job-failed", {
				jobId: parentId,
				error: (error as Error).message,
			});
		}
		throw error;
	}
}

export async function processBulkTaggingDispatchJob(job: Job): Promise<void> {
	const payload = job.payload as BulkTaggingDispatchJobPayload;
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

		// Create jobs (bulk insert)
		const jobRows: NewJob[] = results.map((row) => ({
			type: "auto_tagging",
			mediaSourceId: row.mediaSourceId,
			payload: {
				mediaId: row.id,
				mediaSourceId: row.mediaSourceId,
				force,
			},
		}));
		await db.insert(jobs).values(jobRows);

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
