import type {
	IEmbeddingStore,
	RelatedEmbeddingReader,
	ImageEmbedding,
} from "@solid-imager/application/embeddings";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
	embeddingVectorSchema,
} from "@solid-imager/core/search";
import { imageEmbeddings, medias } from "@solid-imager/db/schema";
import type { DrizzleExecutor } from "@solid-imager/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

/** An independent image/text embedding space; CCIP vectors are never read here. */
export class PostgresEmbeddingStore
	implements IEmbeddingStore, RelatedEmbeddingReader
{
	constructor(private readonly database: DrizzleExecutor) {}

	async get(mediaId: string): Promise<ImageEmbedding | null> {
		const [row] = await this.database
			.select()
			.from(imageEmbeddings)
			.where(
				and(
					eq(imageEmbeddings.mediaId, mediaId),
					eq(imageEmbeddings.model, EMBEDDING_GEMMA_MODEL),
					eq(imageEmbeddings.version, EMBEDDING_GEMMA_VERSION),
				),
			);
		return row
			? {
					mediaId: row.mediaId,
					vector: embeddingVectorSchema.parse(row.embedding),
					model: row.model,
					version: row.version,
					mediaModifiedAt: row.mediaModifiedAt,
				}
			: null;
	}

	async upsert(record: ImageEmbedding): Promise<void> {
		const embedding = embeddingVectorSchema.parse(record.vector);
		if (
			record.model !== EMBEDDING_GEMMA_MODEL ||
			record.version !== EMBEDDING_GEMMA_VERSION
		)
			throw new Error("Incompatible embedding space");
		await this.database
			.insert(imageEmbeddings)
			.values({
				mediaId: record.mediaId,
				embedding,
				model: record.model,
				version: record.version,
				mediaModifiedAt: record.mediaModifiedAt,
			})
			.onConflictDoUpdate({
				target: [
					imageEmbeddings.mediaId,
					imageEmbeddings.model,
					imageEmbeddings.version,
				],
				set: {
					embedding,
					mediaModifiedAt: record.mediaModifiedAt,
					updatedAt: new Date(),
				},
				setWhere: sql`${imageEmbeddings.mediaModifiedAt} <= ${record.mediaModifiedAt}`,
			});
	}

	/** A raw distance ORDER BY lets pgvector stop its HNSW scan at the requested limit. */
	async nearestRelated(vector: number[], anchorId: string, limit: number) {
		const literal = `[${embeddingVectorSchema.parse(vector).join(",")}]`;
		const distance = sql<number>`${imageEmbeddings.embedding} <=> ${literal}::vector`;
		return this.database.transaction(async (tx) => {
			await tx.execute(sql`select set_config('hnsw.ef_search', ${String(limit)}, true),
				set_config('hnsw.iterative_scan', 'strict_order', true)`);
			const rows = await tx
				.select({
					mediaId: imageEmbeddings.mediaId,
					cosineDistance: distance.mapWith(Number),
				})
				.from(imageEmbeddings)
				.where(
					and(
						eq(imageEmbeddings.model, EMBEDDING_GEMMA_MODEL),
						eq(imageEmbeddings.version, EMBEDDING_GEMMA_VERSION),
						sql`${imageEmbeddings.mediaId} <> ${anchorId}`,
						// Keep eligibility inside the limited scan, including for stale embeddings.
						sql`exists (select 1 from ${medias} where ${medias.id} = ${imageEmbeddings.mediaId}
					and ${medias.status} = 'active' and ${medias.mediaType} in ('image','video')
					and ${imageEmbeddings.mediaModifiedAt} = date_trunc('milliseconds', ${medias.modifiedAt})
					offset 0)`,
					),
				)
				.orderBy(distance)
				.limit(limit);
			return rows.sort(
				(a, b) =>
					a.cosineDistance - b.cosineDistance ||
					a.mediaId.localeCompare(b.mediaId),
			);
		});
	}

	async search(
		vector: number[],
		options: Parameters<IEmbeddingStore["search"]>[1],
	) {
		const literal = `[${embeddingVectorSchema.parse(vector).join(",")}]`;
		const rows = await this.database
			.select({
				mediaId: medias.id,
				cosineDistance:
					sql<number>`(${imageEmbeddings.embedding} <=> ${literal}::vector) + 0`.as(
						"cosine_distance",
					),
				total: sql<number>`count(*) over()`,
			})
			.from(imageEmbeddings)
			.innerJoin(medias, eq(medias.id, imageEmbeddings.mediaId))
			.where(
				and(
					eq(imageEmbeddings.model, EMBEDDING_GEMMA_MODEL),
					eq(imageEmbeddings.version, EMBEDDING_GEMMA_VERSION),
					// Drizzle maps timestamps to Date (millisecond precision).
					sql`${imageEmbeddings.mediaModifiedAt} = date_trunc('milliseconds', ${medias.modifiedAt})`,
					inArray(medias.mediaType, ["image", "video"]),
					options.activeOnly ? eq(medias.status, "active") : undefined,
					options.mediaSourceId
						? eq(medias.mediaSourceId, options.mediaSourceId)
						: undefined,
					options.excludeMediaId
						? sql`${medias.id} <> ${options.excludeMediaId}`
						: undefined,
				),
			)
			.orderBy(sql`cosine_distance`, medias.id)
			.limit(options.limit)
			.offset(options.offset);
		const parsed = z
			.array(
				z.object({
					mediaId: z.uuid(),
					cosineDistance: z.coerce.number(),
					total: z.coerce.number().int(),
				}),
			)
			.parse(rows);
		return {
			candidates: parsed.map(({ mediaId, cosineDistance }) => ({
				mediaId,
				cosineDistance,
			})),
			total: parsed[0]?.total ?? 0,
		};
	}
}
