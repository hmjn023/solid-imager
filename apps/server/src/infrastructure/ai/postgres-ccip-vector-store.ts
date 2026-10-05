import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	CcipVectorCandidate,
	CcipVectorMetadata,
	CcipVectorQuery,
	CcipVectorReadQuery,
	CcipVectorRecord,
	ICcipVectorStore,
} from "@solid-imager/application/ports/ccip-vector-store";
import type { ILogger } from "@solid-imager/application/ports/media-service";
import {
	CCIP_VECTOR_DIMENSIONS,
	ccipEmbeddings,
	mediaRegions,
	medias,
} from "@solid-imager/db/schema";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

const FULL_REGION_KIND = "full";

const recordRowSchema = z.object({
	mediaId: z.uuid(),
	mediaSourceId: z.uuid(),
	vector: z.array(z.number()).length(CCIP_VECTOR_DIMENSIONS),
	model: z.string(),
	embeddingVersion: z.number().int(),
	mediaModifiedAt: z.coerce.date(),
	extractedAt: z.coerce.date(),
	processingRevision: z.string().nullable(),
});

const metadataRowSchema = recordRowSchema.omit({ vector: true });

const rawCandidateRowSchema = recordRowSchema.extend({
	vector: z.union([z.string(), z.array(z.number())]).transform(parseVector),
	cosineDistance: z.coerce.number(),
});

function parseVector(value: string | number[]): number[] {
	const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
	if (!isVector(parsed)) {
		throw new Error(
			`Expected a finite ${CCIP_VECTOR_DIMENSIONS}-dimension vector`,
		);
	}
	return parsed;
}

function isVector(value: unknown): value is number[] {
	return (
		Array.isArray(value) &&
		value.length === CCIP_VECTOR_DIMENSIONS &&
		value.every(
			(item: unknown) => typeof item === "number" && Number.isFinite(item),
		)
	);
}

function vectorLiteral(vector: number[]): string {
	const parsed = parseVector(vector);
	const squaredNorm = parsed.reduce((total, value) => total + value * value, 0);
	if (squaredNorm === 0) {
		throw new Error("CCIP vector must not have zero norm");
	}
	return `[${parsed.join(",")}]`;
}

function mapRecord(value: unknown): CcipVectorRecord {
	return recordRowSchema.parse(value);
}

function mapMetadata(value: unknown): CcipVectorMetadata {
	return metadataRowSchema.parse(value);
}

function recordFilters(query?: CcipVectorQuery): SQL | undefined {
	return and(
		eq(mediaRegions.kind, FULL_REGION_KIND),
		query?.mediaSourceId
			? eq(medias.mediaSourceId, query.mediaSourceId)
			: undefined,
		query?.model ? eq(ccipEmbeddings.model, query.model) : undefined,
		query?.embeddingVersion !== undefined
			? eq(ccipEmbeddings.embeddingVersion, query.embeddingVersion)
			: undefined,
	);
}

const recordColumns = {
	mediaId: medias.id,
	mediaSourceId: medias.mediaSourceId,
	vector: ccipEmbeddings.embedding,
	model: ccipEmbeddings.model,
	embeddingVersion: ccipEmbeddings.embeddingVersion,
	mediaModifiedAt: ccipEmbeddings.mediaModifiedAt,
	extractedAt: ccipEmbeddings.extractedAt,
	processingRevision: ccipEmbeddings.processingRevision,
};

/** pgvector-backed CCIP store used by the application at runtime. */
export class PostgresCcipVectorStore implements ICcipVectorStore {
	constructor(
		private readonly database: DrizzleExecutor,
		private readonly logger?: ILogger,
	) {}

	private executor(tx?: Transaction): DrizzleExecutor {
		// Drizzle's public transaction implements the same query API as the database.
		return tx ? (tx as DrizzleExecutor) : this.database;
	}

	async get(
		mediaId: string,
		query: CcipVectorReadQuery,
		tx?: Transaction,
	): Promise<CcipVectorRecord | null> {
		return (await this.getMany([mediaId], query, tx)).get(mediaId) ?? null;
	}

	async getMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
		tx?: Transaction,
	): Promise<Map<string, CcipVectorRecord>> {
		if (mediaIds.length === 0) {
			return new Map();
		}
		const rows = await this.executor(tx)
			.select(recordColumns)
			.from(ccipEmbeddings)
			.innerJoin(mediaRegions, eq(ccipEmbeddings.regionId, mediaRegions.id))
			.innerJoin(medias, eq(mediaRegions.mediaId, medias.id))
			.where(and(inArray(medias.id, mediaIds), recordFilters(query)));
		return new Map(
			rows.map((row) => {
				const record = mapRecord(row);
				return [record.mediaId, record];
			}),
		);
	}

	async getMetadataMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorMetadata>> {
		if (mediaIds.length === 0) {
			return new Map();
		}
		const rows = await this.database
			.select({
				mediaId: medias.id,
				mediaSourceId: medias.mediaSourceId,
				model: ccipEmbeddings.model,
				embeddingVersion: ccipEmbeddings.embeddingVersion,
				mediaModifiedAt: ccipEmbeddings.mediaModifiedAt,
				extractedAt: ccipEmbeddings.extractedAt,
				processingRevision: ccipEmbeddings.processingRevision,
			})
			.from(ccipEmbeddings)
			.innerJoin(mediaRegions, eq(ccipEmbeddings.regionId, mediaRegions.id))
			.innerJoin(medias, eq(mediaRegions.mediaId, medias.id))
			.where(and(inArray(medias.id, mediaIds), recordFilters(query)));
		return new Map(
			rows.map((row) => {
				const metadata = mapMetadata(row);
				return [metadata.mediaId, metadata];
			}),
		);
	}

	async upsert(record: CcipVectorRecord, tx?: Transaction): Promise<void> {
		await this.upsertMany([record], tx);
	}

	async upsertMany(
		records: CcipVectorRecord[],
		tx?: Transaction,
	): Promise<void> {
		if (records.length === 0) {
			return;
		}
		const regionsByMediaId = new Map<string, CcipVectorRecord>();
		const embeddingsByKey = new Map<string, CcipVectorRecord>();
		for (const record of records) {
			vectorLiteral(record.vector);
			const existingRegion = regionsByMediaId.get(record.mediaId);
			if (
				!existingRegion ||
				record.mediaModifiedAt.getTime() >
					existingRegion.mediaModifiedAt.getTime()
			) {
				regionsByMediaId.set(record.mediaId, record);
			}
			const embeddingKey = `${record.mediaId}:${record.model}:${record.embeddingVersion}`;
			const existingEmbedding = embeddingsByKey.get(embeddingKey);
			if (
				!existingEmbedding ||
				record.extractedAt.getTime() > existingEmbedding.extractedAt.getTime()
			) {
				embeddingsByKey.set(embeddingKey, record);
			}
		}
		const now = new Date();
		const write = async (transaction: DrizzleExecutor) => {
			const regions = await transaction
				.insert(mediaRegions)
				.values(
					[...regionsByMediaId.values()].map((record) => ({
						mediaId: record.mediaId,
						kind: "full" as const,
						sourceModifiedAt: record.mediaModifiedAt,
						updatedAt: now,
					})),
				)
				.onConflictDoUpdate({
					target: mediaRegions.mediaId,
					targetWhere: sql`${mediaRegions.kind} = 'full'`,
					set: {
						sourceModifiedAt: sql`
							CASE
								WHEN ${Boolean(tx)} OR excluded.source_modified_at > ${mediaRegions.sourceModifiedAt}
								THEN excluded.source_modified_at
								ELSE ${mediaRegions.sourceModifiedAt}
							END
						`,
						updatedAt: sql`
							CASE
								WHEN ${Boolean(tx)} OR excluded.source_modified_at > ${mediaRegions.sourceModifiedAt}
								THEN excluded.updated_at
								ELSE ${mediaRegions.updatedAt}
							END
						`,
					},
				})
				.returning();
			const regionIdByMediaId = new Map(
				regions.map((region) => [region.mediaId, region.id]),
			);
			const embeddings = [...embeddingsByKey.values()].map((record) => {
				const regionId = regionIdByMediaId.get(record.mediaId);
				if (!regionId) {
					throw new Error(
						`Unable to create full region for media ${record.mediaId}`,
					);
				}
				return {
					regionId,
					embedding: record.vector,
					model: record.model,
					embeddingVersion: record.embeddingVersion,
					mediaModifiedAt: record.mediaModifiedAt,
					extractedAt: record.extractedAt,
					processingRevision: record.processingRevision ?? null,
					updatedAt: now,
				};
			});
			await transaction
				.insert(ccipEmbeddings)
				.values(embeddings)
				.onConflictDoUpdate({
					target: [
						ccipEmbeddings.regionId,
						ccipEmbeddings.model,
						ccipEmbeddings.embeddingVersion,
					],
					set: {
						processingRevision: sql`CASE WHEN excluded.processing_revision IS NOT NULL OR excluded.extracted_at > ${ccipEmbeddings.extractedAt} THEN excluded.processing_revision ELSE ${ccipEmbeddings.processingRevision} END`,
						embedding: sql`
							CASE
								WHEN excluded.processing_revision IS NOT NULL OR excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.embedding
								ELSE ${ccipEmbeddings.embedding}
							END
						`,
						mediaModifiedAt: sql`
							CASE
								WHEN excluded.processing_revision IS NOT NULL OR excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.media_modified_at
								ELSE ${ccipEmbeddings.mediaModifiedAt}
							END
						`,
						extractedAt: sql`
							CASE
								WHEN excluded.processing_revision IS NOT NULL OR excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.extracted_at
								ELSE ${ccipEmbeddings.extractedAt}
							END
						`,
						updatedAt: sql`
							CASE
								WHEN excluded.processing_revision IS NOT NULL OR excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.updated_at
								ELSE ${ccipEmbeddings.updatedAt}
							END
						`,
					},
				});
		};
		if (tx) await write(this.executor(tx));
		else
			await this.database.transaction((transaction) =>
				write(transaction as DrizzleExecutor),
			);
	}

	async delete(mediaId: string): Promise<void> {
		const regionIds = this.database
			.select({ id: mediaRegions.id })
			.from(mediaRegions)
			.where(eq(mediaRegions.mediaId, mediaId));
		await this.database
			.delete(ccipEmbeddings)
			.where(inArray(ccipEmbeddings.regionId, regionIds));
	}

	async deleteBySource(mediaSourceId: string): Promise<void> {
		const regionIds = this.database
			.select({ id: mediaRegions.id })
			.from(mediaRegions)
			.innerJoin(medias, eq(mediaRegions.mediaId, medias.id))
			.where(eq(medias.mediaSourceId, mediaSourceId));
		await this.database
			.delete(ccipEmbeddings)
			.where(inArray(ccipEmbeddings.regionId, regionIds));
	}

	async listMediaIds(query?: CcipVectorQuery): Promise<string[]> {
		const rows = await this.database
			.selectDistinct({ mediaId: medias.id })
			.from(ccipEmbeddings)
			.innerJoin(mediaRegions, eq(ccipEmbeddings.regionId, mediaRegions.id))
			.innerJoin(medias, eq(mediaRegions.mediaId, medias.id))
			.where(recordFilters(query));
		return rows.map((row) => row.mediaId);
	}

	async list(query?: CcipVectorQuery): Promise<CcipVectorRecord[]> {
		const rows = await this.database
			.select(recordColumns)
			.from(ccipEmbeddings)
			.innerJoin(mediaRegions, eq(ccipEmbeddings.regionId, mediaRegions.id))
			.innerJoin(medias, eq(mediaRegions.mediaId, medias.id))
			.where(recordFilters(query));
		return rows.map(mapRecord);
	}

	async search(
		vector: number[],
		limit: number,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorCandidate[]> {
		if (!Number.isSafeInteger(limit) || limit < 1) {
			throw new Error("limit must be a positive integer");
		}
		const literal = vectorLiteral(vector);
		const filters = [
			sql`${mediaRegions.kind} = ${FULL_REGION_KIND}`,
			query?.mediaSourceId
				? sql`${medias.mediaSourceId} = ${query.mediaSourceId}`
				: undefined,
			query?.model ? sql`${ccipEmbeddings.model} = ${query.model}` : undefined,
			query?.embeddingVersion !== undefined
				? sql`${ccipEmbeddings.embeddingVersion} = ${query.embeddingVersion}`
				: undefined,
		].filter((value): value is SQL => value !== undefined);
		const startedAt = performance.now();
		const candidates = await this.database.transaction(async (transaction) => {
			await transaction.execute(
				sql`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`,
			);
			const rows = await transaction
				.select({
					mediaId: medias.id,
					mediaSourceId: medias.mediaSourceId,
					vector: sql<string>`${ccipEmbeddings.embedding}::text`,
					model: ccipEmbeddings.model,
					embeddingVersion: ccipEmbeddings.embeddingVersion,
					mediaModifiedAt: ccipEmbeddings.mediaModifiedAt,
					extractedAt: ccipEmbeddings.extractedAt,
					processingRevision: ccipEmbeddings.processingRevision,
					cosineDistance: sql<number>`${ccipEmbeddings.embedding} <=> ${literal}::vector`,
				})
				.from(ccipEmbeddings)
				.innerJoin(mediaRegions, eq(ccipEmbeddings.regionId, mediaRegions.id))
				.innerJoin(medias, eq(mediaRegions.mediaId, medias.id))
				.where(and(...filters))
				.orderBy(sql`${ccipEmbeddings.embedding} <=> ${literal}::vector`)
				.limit(limit);
			return rows.map((row) => rawCandidateRowSchema.parse(row));
		});
		this.logger?.info(
			{
				durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
				candidateCount: candidates.length,
				limit,
				hasMediaSourceFilter: Boolean(query?.mediaSourceId),
			},
			"CCIP pgvector candidate search completed",
		);
		return candidates;
	}
}
