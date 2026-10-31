import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
	embeddingExtractionPayloadSchema,
} from "@solid-imager/core/domain/search/embedding";
import { batchCcipExtractionRequestSchema } from "@solid-imager/core/domain/tagging/schemas";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/infrastructure/db";
import {
	imageEmbeddings,
	jobs,
	medias,
	mediaSources,
	type Job,
} from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { getEmbeddingSearchService } from "~/infrastructure/services/embedding-search-service";

const batchPayloadSchema = batchCcipExtractionRequestSchema.extend({
	cursor: z.uuid().optional(),
	processed: z.number().int().nonnegative().default(0),
	failed: z.number().int().nonnegative().default(0),
	total: z.number().int().nonnegative().default(0),
});

function targetQuery(
	input: z.infer<typeof batchCcipExtractionRequestSchema>,
	cursor?: string,
) {
	return db
		.select({ id: medias.id, mediaSourceId: medias.mediaSourceId })
		.from(medias)
		.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
		.leftJoin(
			imageEmbeddings,
			and(
				eq(imageEmbeddings.mediaId, medias.id),
				eq(imageEmbeddings.model, EMBEDDING_GEMMA_MODEL),
				eq(imageEmbeddings.version, EMBEDDING_GEMMA_VERSION),
			),
		)
		.where(
			and(
				eq(medias.mediaType, "image"),
				eq(mediaSources.type, "local"),
				input.mediaSourceId
					? eq(medias.mediaSourceId, input.mediaSourceId)
					: undefined,
				cursor ? gt(medias.id, cursor) : undefined,
				input.force
					? undefined
					: or(
							isNull(imageEmbeddings.id),
							sql`${imageEmbeddings.mediaModifiedAt} <> date_trunc('milliseconds', ${medias.modifiedAt})`,
						),
			),
		)
		.orderBy(asc(medias.id));
}

export async function countEmbeddingTargets(
	input: z.infer<typeof batchCcipExtractionRequestSchema>,
): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(targetQuery(input).as("targets"));
	return Number(row?.count ?? 0);
}

export async function processEmbeddingBatchJob(job: Job): Promise<void> {
	const payload = batchPayloadSchema.parse(job.payload);
	const service = getEmbeddingSearchService();
	const repository = services.getJobRepository();
	const total = payload.total || (await countEmbeddingTargets(payload));
	let { processed, failed, cursor } = payload;
	const persist = async () => {
		const updated = await db
			.update(jobs)
			.set({
				payload: { ...payload, cursor, processed, failed, total },
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(jobs.id, job.id),
					eq(jobs.attemptCount, job.attemptCount ?? 0),
					eq(jobs.status, "in_progress"),
				),
			)
			.returning();
		if (updated.length === 0) return false;
		RealtimeEventBus.publishJob("job-progress", {
			jobId: job.id,
			processed,
			total,
		});
		return true;
	};
	if (!(await persist())) return;
	while (true) {
		const rows = await targetQuery(payload, cursor).limit(100);
		if (rows.length === 0) break;
		for (const row of rows) {
			const currentJob = await repository.findById(job.id);
			if (
				!currentJob ||
				currentJob.cancelRequestedAt ||
				currentJob.status === "cancelled" ||
				currentJob.attemptCount !== job.attemptCount
			)
				return;
			try {
				await service.extract(row.mediaSourceId, row.id, payload.force);
				processed += 1;
			} catch (error) {
				failed += 1;
				logger.error(
					{ err: error, jobId: job.id, mediaId: row.id },
					"EmbeddingGemma 2 extraction failed",
				);
			}
			cursor = row.id;
			if (!(await persist())) return;
		}
	}
	if (failed > 0) {
		// A user retry must revisit failed images; successful current vectors are skipped.
		await repository.update(job.id, {
			payload: { force: payload.force, mediaSourceId: payload.mediaSourceId },
		});
		throw new Error(`${failed} EmbeddingGemma 2 extraction(s) failed`);
	}
	logger.info(
		{ jobId: job.id, processed },
		"EmbeddingGemma 2 indexing completed",
	);
}

export async function processEmbeddingExtractionJob(job: Job): Promise<void> {
	const input = embeddingExtractionPayloadSchema.parse(job.payload);
	if (!job.mediaSourceId)
		throw new Error("Embedding extraction requires a media source");
	await getEmbeddingSearchService().extract(
		job.mediaSourceId,
		input.mediaId,
		input.force,
	);
}
