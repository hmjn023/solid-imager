import { getErrorMessage } from "@solid-imager/core/utils";
import {
	type CcipVectorMetadata,
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/ccip";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/infrastructure/db";
import type { Job } from "@solid-imager/core/jobs";
import {
	jobs,
	mediaSources,
	medias,
	type NewJob,
} from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";

const singleExtractionPayloadSchema = z.object({
	mediaId: z.uuid(),
	force: z.boolean().default(false),
});

const batchExtractionPayloadSchema = z.object({
	mediaIds: z.array(z.uuid()).min(1).max(25),
	force: z.boolean().default(false),
});

const extractionPayloadSchema = z.union([
	singleExtractionPayloadSchema,
	batchExtractionPayloadSchema,
]);

const batchCcipDispatchPayloadSchema = z.object({
	force: z.boolean().default(false),
	batchSize: z.number().int().min(1).max(5000).optional(),
	mediaSourceId: z.uuid().optional(),
});

const dispatchedChildPayloadSchema = z.union([
	z.object({ mediaId: z.uuid() }),
	z.object({ mediaIds: z.array(z.uuid()) }),
]);

const EXTRACTION_JOB_BATCH_SIZE = 25;
const CHILD_INSERT_CHUNK = 500;

function extractDispatchedMediaIds(payload: unknown): string[] {
	let normalizedPayload = payload;
	if (typeof normalizedPayload === "string") {
		try {
			normalizedPayload = JSON.parse(normalizedPayload);
		} catch {
			return [];
		}
	}

	const parsedPayload =
		dispatchedChildPayloadSchema.safeParse(normalizedPayload);
	if (!parsedPayload.success) {
		return [];
	}

	return "mediaId" in parsedPayload.data
		? [parsedPayload.data.mediaId]
		: parsedPayload.data.mediaIds;
}

async function finalizeBatchParent(
	parentId: string,
	progress: { processed: number; failed: number; total: number },
): Promise<void> {
	const jobRepo = services.getJobRepository();
	const status = await jobRepo.finishBatch(parentId);
	if (!status) return;
	if (status === "failed") {
		RealtimeEventBus.publishJob("job-failed", {
			jobId: parentId,
			error: `${progress.failed} batch item(s) failed`,
		});
	} else if (status === "completed") {
		RealtimeEventBus.publishJob("job-completed", {
			jobId: parentId,
			message: "Batch completed",
		});
	}
}

/** Queues CCIP extraction in chunks and sets the parent total to the number of distinct media IDs, including previously dispatched items on resume. */
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

	// Resume support only needs the media IDs already dispatched for this
	// parent. Loading them once avoids re-scanning the entire jobs table for
	// every 1,000-media page, which becomes very expensive for large batches.
	const existingChildren = await db
		.select({ payload: jobs.payload })
		.from(jobs)
		.where(
			and(eq(jobs.parentId, parentId), eq(jobs.type, "extract_ccip_vector")),
		);
	const dispatchedMediaIds = new Set(
		existingChildren.flatMap(({ payload }) =>
			extractDispatchedMediaIds(payload),
		),
	);

	const baseWhere = and(
		inArray(medias.mediaType, ["image", "video"]),
		eq(mediaSources.type, "local"),
		mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
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
			.where(and(baseWhere, lastSeenId ? gt(medias.id, lastSeenId) : undefined))
			.orderBy(asc(medias.id))
			.limit(batchSize);

		if (rows.length === 0) {
			if (dispatchedCount === 0) {
				logger.info(
					{ jobId: job.id, parentId, mediaSourceId, force },
					"No matching media found for batch CCIP extraction",
				);
			}
			break;
		}

		const mediaIds = rows.map((row) => row.id);
		const existingById = force
			? new Map<string, CcipVectorMetadata>()
			: await ccipVectorService.getMetadataMany(mediaIds);

		const targetRows = rows
			.filter((row) => !dispatchedMediaIds.has(row.id))
			.filter((row) => {
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
		for (const row of targetRows) {
			dispatchedMediaIds.add(row.id);
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
	// Includes children from earlier dispatch attempts as well as newly inserted pages.
	const total = dispatchedMediaIds.size;
	const parentPayload = await jobRepo.setBatchTotal(parentId, total);

	if (total === 0) {
		await finalizeBatchParent(parentId, { processed: 0, failed: 0, total: 0 });
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

		await updateParentProgress(job, 1, 0);
	} catch (error) {
		logger.error({ err: error, mediaIds }, "CCIP vector extraction failed");
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
}

/** Records the child attempt’s successful and failed media counts and closes the batch once all target media are accounted for. */
async function updateParentProgress(
	job: Job,
	processed: number,
	failed: number,
): Promise<void> {
	if (!job.parentId) {
		return;
	}
	const jobRepo = services.getJobRepository();
	const progress = await jobRepo.recordBatchChildOutcome(
		job.parentId,
		job.id,
		job.attemptCount ?? 0,
		processed,
		failed,
	);
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
