import type { CcipVectorMetadata } from "@solid-imager/application/ports/ccip-vector-store";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/services/ccip-vector-service";
import { prepareJob } from "@solid-imager/core/domain/jobs/registry";
import { createMediaSourceRevision } from "@solid-imager/core/domain/media/revision";
import type {
	Job,
	NewJob,
} from "@solid-imager/core/domain/repositories/job-repository";
import { getErrorMessage } from "@solid-imager/core/utils";
import { and, asc, eq, gt, notExists, or, sql } from "drizzle-orm";
import { z } from "zod";
import { services } from "~/application/registry";
import { ccipVectorService } from "~/application/services/ccip-vector-service";
import { db } from "~/infrastructure/db";
import {
	jobs,
	mediaSources,
	medias,
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

const CHILD_INSERT_CHUNK = 500;

export async function processBatchCcipDispatchJob(
	job: ExecutableJob,
): Promise<void> {
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
				fileSize: medias.fileSize,
				width: medias.width,
				height: medias.height,
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
			for (const row of sourceRows) {
				const inputRevision = await createMediaSourceRevision({
					mediaId: row.id,
					mediaSourceId: row.mediaSourceId,
					modifiedAt: row.modifiedAt,
					fileSize: row.fileSize,
					width: row.width,
					height: row.height,
				});
				jobRows.push({
					type: "extract_ccip_vector",
					mediaSourceId: sourceId,
					parentId,
					targetId: row.id,
					inputRevision,
					payload: {
						mediaId: row.id,
						force,
					},
				});
			}
		}
		for (let i = 0; i < jobRows.length; i += CHILD_INSERT_CHUNK) {
			const chunk = jobRows.slice(i, i + CHILD_INSERT_CHUNK);
			await db.insert(jobs).values(chunk.map(prepareJob)).onConflictDoNothing();
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
	const progress = await jobRepo.recomputeBatchProgress(parentId);
	const total = progress?.total ?? 0;

	if (total === 0) {
		await jobRepo.update(parentId, { status: "completed" });
		RealtimeEventBus.publishJob("job-completed", {
			jobId: parentId,
			message: "Batch CCIP extraction completed (no targets)",
		});
	} else {
		RealtimeEventBus.publishJob("job-progress", {
			jobId: parentId,
			processed: progress?.processed ?? 0,
			total,
		});
	}

	logger.info(
		{ jobId: job.id, parentId, dispatchedCount },
		"Batch CCIP dispatch completed",
	);
}

export async function processCcipExtractionJob(
	job: ExecutableJob,
	signal?: AbortSignal,
): Promise<unknown> {
	const payload = extractionPayloadSchema.parse(job.payload);
	if (!job.mediaSourceId) {
		throw new Error("CCIP extraction job is missing mediaSourceId");
	}
	const mediaIds = "mediaIds" in payload ? payload.mediaIds : [payload.mediaId];
	if (mediaIds.length > 1) {
		await processCcipExtractionBatch(job, mediaIds, payload.force, signal);
		return;
	}
	try {
		const mediaId = mediaIds[0];
		const result = await ccipVectorService.extract(
			job.mediaSourceId,
			mediaId,
			payload.force,
			signal,
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
		return result;
	} catch (error) {
		logger.error({ err: error, mediaIds }, "CCIP vector extraction failed");
		throw error;
	}
}

async function processCcipExtractionBatch(
	job: ExecutableJob,
	mediaIds: string[],
	force: boolean,
	signal?: AbortSignal,
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
			signal,
		);
	} catch (error) {
		logger.error(
			{ err: error, mediaIds },
			"CCIP vector extraction batch failed",
		);
		throw error;
	}
	const failures = results.filter(
		(result): result is PromiseRejectedResult => result.status === "rejected",
	);
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
