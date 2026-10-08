import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/infrastructure/db";
import { type Job, jobs, type NewJob } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { scanTaggingTargetPage } from "./tagging-targets";
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
		const owner = { jobId: job.id, attemptCount: job.attemptCount ?? 0 };
		const requests = await taggingService.reserveTagsForJob(
			owner,
			mediaSourceId,
			[mediaId],
			force,
		);
		const result = await taggingService.getTagsForMedia(
			mediaSourceId,
			mediaId,
			{
				skipCache: force,
				owner,
				request: requests[mediaId],
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
			const progress = await jobRepo.incrementProgress(parentId, job.id);
			if (!progress || progress.total === 0) {
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
			if (progress && progress.total > 0) {
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

	let lastSeenId: string | undefined;
	let dispatchedCount = 0;
	const CHILD_INSERT_CHUNK = 500;

	while (true) {
		const page = await scanTaggingTargetPage({
			mediaSourceId,
			force,
			limit: batchSize,
			afterId: lastSeenId,
			parentId,
		});
		const results = page.targets;

		if (!page.nextCursor) {
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
			await db.transaction(async (tx) => {
				const reservedRows: NewJob[] = [];
				for (const row of chunk) {
					const target = autoTaggingPayloadSchema.parse(row.payload);
					if (!row.mediaSourceId) throw new Error("Tagging source is missing");
					const state = await taggingService.requestTags(
						row.mediaSourceId,
						target.mediaId,
						target.force,
						tx,
					);
					reservedRows.push({
						...row,
						payload: {
							...target,
							force: false,
							processingRequests: {
								[target.mediaId]: {
									requestId: state.requestId,
									requestedRevision: state.requestedRevision,
								},
							},
						},
					});
				}
				await tx.insert(jobs).values(reservedRows);
			});
		}

		dispatchedCount += results.length;
		lastSeenId = page.nextCursor;

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
	const parentPayload = batchParentPayloadSchema.parse(
		parentJob?.payload ?? {},
	);
	const [{ count: rawTotalChildCount }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(jobs)
		.where(and(eq(jobs.parentId, parentId), eq(jobs.type, "auto_tagging")));
	const totalChildCount = Number(rawTotalChildCount ?? 0);
	const progress = {
		processed: parentPayload.processed,
		failed: parentPayload.failed,
		total: totalChildCount,
	};
	await jobRepo.update(parentId, {
		payload: { ...parentPayload, total: totalChildCount },
	});

	if (totalChildCount === 0) {
		await jobRepo.update(parentId, { status: "completed" });
		RealtimeEventBus.publishJob("job-completed", {
			jobId: parentId,
			message: "Batch tagging completed (no targets)",
		});
	} else {
		RealtimeEventBus.publishJob("job-progress", {
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
