import type { CcipVectorRecord } from "@solid-imager/application/ports/ccip-vector-store";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/services/ccip-vector-service";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import { and, asc, eq, gt, notExists, sql } from "drizzle-orm";
import { z } from "zod";
import { services } from "~/application/registry";
import { ccipVectorService } from "~/application/services/ccip-vector-service";
import { db } from "~/infrastructure/db";
import {
	type Job,
	jobs,
	mediaSources,
	medias,
	type NewJob,
} from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";

const payloadSchema = z.object({
	mediaId: z.string().uuid(),
	force: z.boolean().default(false),
});

const batchCcipDispatchPayloadSchema = z.object({
	force: z.boolean().default(false),
	batchSize: z.number().optional(),
	mediaSourceId: z.string().uuid().optional(),
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
		message: "CCIP vector extraction completed",
	});
}

export async function processBatchCcipDispatchJob(job: Job): Promise<void> {
	const payload = batchCcipDispatchPayloadSchema.parse(job.payload);
	const force = payload.force ?? false;
	const batchSize = payload.batchSize ?? 1000;
	const mediaSourceId = payload.mediaSourceId;
	const parentId = job.parentId;
	if (!parentId) {
		throw new Error("batch_ccip_dispatch requires parentId");
	}

	logger.info(
		{ jobId: job.id, parentId, mediaSourceId, force, batchSize },
		"Starting batch CCIP dispatch job",
	);

	const baseWhere = and(
		eq(medias.mediaType, "image"),
		eq(mediaSources.type, "local"),
		mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
	);

	const existingChild = db
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				eq(jobs.parentId, parentId),
				eq(jobs.type, "extract_ccip_vector"),
				sql`(${jobs.payload}->>'mediaId')::uuid = ${medias.id}`,
			),
		);

	let lastSeenId: string | null = null;
	let dispatchedCount = 0;
	const CHILD_INSERT_CHUNK = 500;

	while (true) {
		const rows = await db
			.select({
				id: medias.id,
				mediaSourceId: medias.mediaSourceId,
				modifiedAt: medias.modifiedAt,
			})
			.from(medias)
			.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
			.where(
				and(
					baseWhere,
					notExists(existingChild),
					lastSeenId ? gt(medias.id, lastSeenId) : undefined,
				),
			)
			.orderBy(asc(medias.id))
			.limit(batchSize);

		if (rows.length === 0) {
			if (dispatchedCount === 0) {
				logger.info(
					{ jobId: job.id, parentId, mediaSourceId, force },
					"No matching images found for batch CCIP extraction",
				);
			}
			break;
		}

		const mediaIds = rows.map((row) => row.id);
		const existingById = force
			? new Map<string, CcipVectorRecord>()
			: await ccipVectorService.getMany(mediaIds);

		const targetRows = rows.filter((row) => {
			const record = existingById.get(row.id);
			return (
				!record ||
				record.model !== CCIP_MODEL ||
				record.embeddingVersion !== CCIP_EMBEDDING_VERSION ||
				record.mediaModifiedAt.getTime() !== row.modifiedAt.getTime()
			);
		});

		const jobRows: NewJob[] = targetRows.map((row) => ({
			type: "extract_ccip_vector",
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

		dispatchedCount += targetRows.length;
		lastSeenId = rows[rows.length - 1].id;

		logger.info(
			{
				jobId: job.id,
				parentId,
				dispatchedCount,
			},
			"Batch CCIP dispatch progress",
		);
	}

	const jobRepo = services.getJobRepository();
	const parentJob = await jobRepo.findById(parentId);
	const parentPayload = batchParentPayloadSchema.parse(
		parentJob?.payload ?? {},
	);
	await jobRepo.update(parentId, {
		payload: { ...parentPayload, total: dispatchedCount },
	});

	if (dispatchedCount === 0) {
		await jobRepo.update(parentId, { status: "completed" });
		RealtimeEventBus.publishJob("job-completed", {
			jobId: parentId,
			message: "Batch CCIP extraction completed (no targets)",
		});
	} else {
		RealtimeEventBus.publishJob("job-progress", {
			jobId: parentId,
			processed: 0,
			total: dispatchedCount,
		});
	}

	logger.info(
		{ jobId: job.id, parentId, dispatchedCount },
		"Batch CCIP dispatch completed",
	);
}

export async function processCcipExtractionJob(job: Job): Promise<void> {
	const payload = payloadSchema.parse(job.payload);
	if (!job.mediaSourceId) {
		throw new Error("CCIP extraction job is missing mediaSourceId");
	}
	try {
		const result = await ccipVectorService.extract(
			job.mediaSourceId,
			payload.mediaId,
			payload.force,
		);
		logger.info(
			{
				jobId: job.id,
				parentId: job.parentId,
				mediaSourceId: job.mediaSourceId,
				mediaId: payload.mediaId,
				force: payload.force,
				skipped: result.skipped,
			},
			"CCIP vector extraction completed",
		);
		RealtimeEventBus.publishJob("job-completed", {
			jobId: job.id,
			message: "CCIP vector extraction completed",
		});

		if (job.parentId) {
			const jobRepo = services.getJobRepository();
			const progress = await jobRepo.incrementProgress(job.parentId, job.id);
			if (progress && progress.total > 0) {
				RealtimeEventBus.publishJob("job-progress", {
					jobId: job.parentId,
					processed: progress.processed,
					total: progress.total,
				});
				if (progress.processed + progress.failed >= progress.total) {
					await finalizeBatchParent(job.parentId, progress);
				}
			}
		}
	} catch (error) {
		logger.error(
			{ err: error, mediaId: payload.mediaId },
			"CCIP vector extraction failed",
		);
		RealtimeEventBus.publishJob("job-failed", {
			jobId: job.id,
			error: getErrorMessage(error),
		});
		if (job.parentId) {
			const jobRepo = services.getJobRepository();
			const progress = await jobRepo.incrementFailedCount(job.parentId, job.id);
			if (progress && progress.total > 0) {
				RealtimeEventBus.publishJob("job-progress", {
					jobId: job.parentId,
					processed: progress.processed,
					total: progress.total,
				});
				if (progress.processed + progress.failed >= progress.total) {
					await finalizeBatchParent(job.parentId, progress);
				}
			}
		}
		throw error;
	}
}
