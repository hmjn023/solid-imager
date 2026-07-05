import type { CcipVectorMetadata } from "@solid-imager/application/ports/ccip-vector-store";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/services/ccip-vector-service";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import { and, asc, eq, gt, notExists, or, sql } from "drizzle-orm";
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

const singleExtractionPayloadSchema = z.object({
	mediaId: z.string().uuid(),
	force: z.boolean().default(false),
});

const batchExtractionPayloadSchema = z.object({
	mediaIds: z.array(z.string().uuid()).min(1).max(25),
	force: z.boolean().default(false),
});

const extractionPayloadSchema = z.union([
	singleExtractionPayloadSchema,
	batchExtractionPayloadSchema,
]);

const batchCcipDispatchPayloadSchema = z.object({
	force: z.boolean().default(false),
	batchSize: z.number().int().min(1).max(5000).optional(),
	mediaSourceId: z.string().uuid().optional(),
});

const EXTRACTION_JOB_BATCH_SIZE = 25;
const CHILD_INSERT_CHUNK = 500;

async function finalizeBatchParent(
	parentId: string,
	progress: { processed: number; failed: number; total: number },
): Promise<void> {
	const jobRepo = services.getJobRepository();
	if (progress.failed > 0) {
		await jobRepo.update(parentId, { status: "failed" });
		RealtimeEventBus.publishJob("job-failed", {
			jobId: parentId,
			error: `${progress.failed} item(s) failed`,
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
				or(
					sql`${jobs.payload}->>'mediaId' = ${medias.id}::text`,
					sql`(${jobs.payload}->'mediaIds') ? ${medias.id}::text`,
				),
			),
		);

	let lastSeenId: string | null = null;
	let dispatchedCount = 0;

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
			? new Map<string, CcipVectorMetadata>()
			: await ccipVectorService.getMetadataMany(mediaIds);

		const targetRows = rows.filter((row) => {
			const record = existingById.get(row.id);
			return (
				!record ||
				record.model !== CCIP_MODEL ||
				record.embeddingVersion !== CCIP_EMBEDDING_VERSION ||
				record.mediaModifiedAt.getTime() !== row.modifiedAt.getTime()
			);
		});

		const rowsBySource = new Map<string, typeof targetRows>();
		for (const row of targetRows) {
			const sourceRows = rowsBySource.get(row.mediaSourceId) ?? [];
			sourceRows.push(row);
			rowsBySource.set(row.mediaSourceId, sourceRows);
		}
		const jobRows: NewJob[] = [];
		for (const [sourceId, sourceRows] of rowsBySource) {
			for (
				let index = 0;
				index < sourceRows.length;
				index += EXTRACTION_JOB_BATCH_SIZE
			) {
				jobRows.push({
					type: "extract_ccip_vector",
					mediaSourceId: sourceId,
					parentId,
					payload: {
						mediaIds: sourceRows
							.slice(index, index + EXTRACTION_JOB_BATCH_SIZE)
							.map((row) => row.id),
						force,
					},
				});
			}
		}
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
	const [childSummary] = await db
		.select({
			total: sql<number>`COALESCE(SUM(
				CASE
					WHEN jsonb_typeof(${jobs.payload}->'mediaIds') = 'array'
						THEN jsonb_array_length(${jobs.payload}->'mediaIds')
					ELSE 1
				END
			), 0)::int`,
		})
		.from(jobs)
		.where(
			and(eq(jobs.parentId, parentId), eq(jobs.type, "extract_ccip_vector")),
		);
	const total = Number(childSummary?.total ?? 0);
	const [updatedParent] = await db
		.update(jobs)
		.set({
			payload: sql`jsonb_set(
				COALESCE(${jobs.payload}, '{}'::jsonb),
				'{total}',
				to_jsonb(${total}::int)
			)`,
			updatedAt: new Date(),
		})
		.where(eq(jobs.id, parentId))
		.returning();
	const parentPayload = batchParentPayloadSchema.parse(
		updatedParent?.payload ?? {},
	);

	if (total === 0) {
		await jobRepo.update(parentId, { status: "completed" });
		RealtimeEventBus.publishJob("job-completed", {
			jobId: parentId,
			message: "Batch CCIP extraction completed (no targets)",
		});
	} else {
		RealtimeEventBus.publishJob("job-progress", {
			jobId: parentId,
			processed: parentPayload.processed,
			total,
		});
		if (parentPayload.processed + parentPayload.failed >= total) {
			await finalizeBatchParent(parentId, {
				processed: parentPayload.processed,
				failed: parentPayload.failed,
				total,
			});
		}
	}

	logger.info(
		{ jobId: job.id, parentId, dispatchedCount },
		"Batch CCIP dispatch completed",
	);
}

export async function processCcipExtractionJob(job: Job): Promise<void> {
	const payload = extractionPayloadSchema.parse(job.payload);
	if (!job.mediaSourceId) {
		throw new Error("CCIP extraction job is missing mediaSourceId");
	}
	const mediaIds = "mediaIds" in payload ? payload.mediaIds : [payload.mediaId];
	if (mediaIds.length > 1) {
		await processCcipExtractionBatch(job, mediaIds, payload.force);
		return;
	}
	try {
		const mediaId = mediaIds[0];
		const result = await ccipVectorService.extract(
			job.mediaSourceId,
			mediaId,
			payload.force,
		);
		logger.info(
			{
				jobId: job.id,
				parentId: job.parentId,
				mediaSourceId: job.mediaSourceId,
				mediaId,
				force: payload.force,
				skipped: result.skipped,
			},
			"CCIP vector extraction completed",
		);
		RealtimeEventBus.publishJob("job-completed", {
			jobId: job.id,
			message: "CCIP vector extraction completed",
		});

		await updateParentProgress(job, 1, 0);
	} catch (error) {
		logger.error({ err: error, mediaIds }, "CCIP vector extraction failed");
		RealtimeEventBus.publishJob("job-failed", {
			jobId: job.id,
			error: getErrorMessage(error),
		});
		await updateParentProgress(job, 0, mediaIds.length);
		throw error;
	}
}

async function processCcipExtractionBatch(
	job: Job,
	mediaIds: string[],
	force: boolean,
): Promise<void> {
	if (!job.mediaSourceId) {
		throw new Error("CCIP extraction job is missing mediaSourceId");
	}
	let results: Awaited<ReturnType<typeof ccipVectorService.extractBatch>>;
	try {
		results = await ccipVectorService.extractBatch(
			job.mediaSourceId,
			mediaIds,
			force,
			1,
		);
	} catch (error) {
		logger.error(
			{ err: error, mediaIds },
			"CCIP vector extraction batch failed",
		);
		RealtimeEventBus.publishJob("job-failed", {
			jobId: job.id,
			error: getErrorMessage(error),
		});
		await updateParentProgress(job, 0, mediaIds.length);
		throw error;
	}
	const processed = results.filter(
		(result) => result.status === "fulfilled",
	).length;
	const failures = results.filter(
		(result): result is PromiseRejectedResult => result.status === "rejected",
	);
	await updateParentProgress(job, processed, failures.length);

	if (failures.length > 0) {
		const error = new Error(
			`${failures.length} of ${mediaIds.length} CCIP extraction(s) failed: ${getErrorMessage(failures[0].reason)}`,
		);
		logger.error(
			{ err: error, mediaIds },
			"CCIP vector extraction batch failed",
		);
		RealtimeEventBus.publishJob("job-failed", {
			jobId: job.id,
			error: error.message,
		});
		throw error;
	}

	logger.info(
		{
			jobId: job.id,
			parentId: job.parentId,
			mediaSourceId: job.mediaSourceId,
			count: mediaIds.length,
			force,
		},
		"CCIP vector extraction batch completed",
	);
	RealtimeEventBus.publishJob("job-completed", {
		jobId: job.id,
		message: `CCIP vector extraction completed (${mediaIds.length} items)`,
	});
}

async function updateParentProgress(
	job: Job,
	processed: number,
	failed: number,
): Promise<void> {
	if (!job.parentId) {
		return;
	}
	const jobRepo = services.getJobRepository();
	let progress = null;
	if (processed > 0) {
		progress = await jobRepo.incrementProgress(job.parentId, job.id, processed);
	}
	if (failed > 0) {
		progress = await jobRepo.incrementFailedCount(job.parentId, job.id, failed);
	}
	if (!progress || progress.total <= 0) {
		return;
	}
	RealtimeEventBus.publishJob("job-progress", {
		jobId: job.parentId,
		processed: progress.processed,
		total: progress.total,
	});
	if (progress.processed + progress.failed >= progress.total) {
		await finalizeBatchParent(job.parentId, progress);
	}
}
