import type {
	CcipVectorCandidate,
	CcipEmbeddingKey,
	CcipVectorMetadata,
	CcipVectorQuery,
	CcipVectorReadQuery,
	CcipVectorRecord,
	ICcipVectorStore,
} from "@solid-imager/application/ports/ccip-vector-store";
import type { ILogger } from "@solid-imager/application/ports/media-service";
import {
	createCcipEmbeddingInputRevision,
	createMediaRegionRevision,
	createMediaSourceRevision,
} from "@solid-imager/core/domain/media/revision";
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
	regionId: z.string().uuid(),
	regionKind: z.enum(["full", "person", "manual"]),
	mediaId: z.string().uuid(),
	mediaSourceId: z.string().uuid(),
	vector: z.array(z.number().finite()).length(CCIP_VECTOR_DIMENSIONS),
	model: z.string(),
	embeddingVersion: z.number().int(),
	mediaModifiedAt: z.coerce.date(),
	inputRevision: z.string().min(1),
	preprocessingProfile: z.string().min(1),
	extractedAt: z.coerce.date(),
});

const metadataRowSchema = recordRowSchema.omit({ vector: true });

const rawCandidateRowSchema = recordRowSchema.extend({
	vector: z
		.union([z.string(), z.array(z.number().finite())])
		.transform(parseVector),
	cosineDistance: z.coerce.number().finite(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRows(value: unknown): unknown[] {
	if (Array.isArray(value)) {
		return value;
	}
	if (isRecord(value) && Array.isArray(value.rows)) {
		return value.rows;
	}
	return [];
}

function parseVector(value: string | number[]): number[] {
	const parsed = typeof value === "string" ? JSON.parse(value) : value;
	if (
		!Array.isArray(parsed) ||
		parsed.length !== CCIP_VECTOR_DIMENSIONS ||
		!parsed.every((item) => typeof item === "number" && Number.isFinite(item))
	) {
		throw new Error(
			`Expected a finite ${CCIP_VECTOR_DIMENSIONS}-dimension vector`,
		);
	}
	return parsed;
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
		query?.regionId ? eq(mediaRegions.id, query.regionId) : undefined,
		query?.regionKind
			? eq(mediaRegions.kind, query.regionKind)
			: eq(mediaRegions.kind, FULL_REGION_KIND),
		query?.mediaSourceId
			? eq(medias.mediaSourceId, query.mediaSourceId)
			: undefined,
		query?.model ? eq(ccipEmbeddings.model, query.model) : undefined,
		query?.embeddingVersion !== undefined
			? eq(ccipEmbeddings.embeddingVersion, query.embeddingVersion)
			: undefined,
		query?.preprocessingProfile
			? eq(
					ccipEmbeddings.preprocessingProfile,
					query.preprocessingProfile,
				)
			: undefined,
	);
}

const recordColumns = {
	regionId: mediaRegions.id,
	regionKind: mediaRegions.kind,
	mediaId: medias.id,
	mediaSourceId: medias.mediaSourceId,
	vector: ccipEmbeddings.embedding,
	model: ccipEmbeddings.model,
	embeddingVersion: ccipEmbeddings.embeddingVersion,
	mediaModifiedAt: ccipEmbeddings.mediaModifiedAt,
	inputRevision: ccipEmbeddings.inputRevision,
	preprocessingProfile: ccipEmbeddings.preprocessingProfile,
	extractedAt: ccipEmbeddings.extractedAt,
};

type MediaRevisionRow = {
	id: string;
	mediaSourceId: string;
	modifiedAt: Date;
	fileSize: number | null;
	width: number;
	height: number;
};

/** pgvector-backed CCIP store used by the application at runtime. */
export class PostgresCcipVectorStore implements ICcipVectorStore {
	constructor(
		private readonly database: DrizzleExecutor,
		private readonly logger?: ILogger,
	) {}

	async getByRegion(
		regionId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null> {
		const rows = await this.database
			.select(recordColumns)
			.from(ccipEmbeddings)
			.innerJoin(mediaRegions, eq(ccipEmbeddings.regionId, mediaRegions.id))
			.innerJoin(medias, eq(mediaRegions.mediaId, medias.id))
			.where(recordFilters({ ...query, regionId }))
			.limit(1);
		return rows[0] ? mapRecord(rows[0]) : null;
	}

	async get(
		mediaId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null> {
		return (await this.getMany([mediaId], query)).get(mediaId) ?? null;
	}

	async getMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorRecord>> {
		if (mediaIds.length === 0) {
			return new Map();
		}
		const rows = await this.database
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
				regionId: mediaRegions.id,
				regionKind: mediaRegions.kind,
				mediaSourceId: medias.mediaSourceId,
				model: ccipEmbeddings.model,
				embeddingVersion: ccipEmbeddings.embeddingVersion,
				mediaModifiedAt: ccipEmbeddings.mediaModifiedAt,
				inputRevision: ccipEmbeddings.inputRevision,
				preprocessingProfile: ccipEmbeddings.preprocessingProfile,
				extractedAt: ccipEmbeddings.extractedAt,
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

	async upsert(record: CcipVectorRecord): Promise<void> {
		await this.upsertMany([record]);
	}

	async upsertMany(records: CcipVectorRecord[]): Promise<void> {
		await this.writeMany(records, true);
	}

	/** One-time migration path. Runtime callers must use revision-fenced upsert. */
	async importLegacyMany(records: CcipVectorRecord[]): Promise<void> {
		await this.writeMany(records, false);
	}

	private async writeMany(
		records: CcipVectorRecord[],
		requireCurrentRevision: boolean,
	): Promise<void> {
		if (records.length === 0) {
			return;
		}
		for (const record of records) {
			vectorLiteral(record.vector);
			if (record.regionKind !== "full" && !record.regionId) {
				throw new Error("Cropped CCIP embeddings require a regionId");
			}
		}
		const now = new Date();
		await this.database.transaction(async (transaction) => {
			const mediaIds = [...new Set(records.map((record) => record.mediaId))];
			const mediaRows: MediaRevisionRow[] = await transaction
				.select({
					id: medias.id,
					mediaSourceId: medias.mediaSourceId,
					modifiedAt: medias.modifiedAt,
					fileSize: medias.fileSize,
					width: medias.width,
					height: medias.height,
				})
				.from(medias)
				.where(inArray(medias.id, mediaIds))
				.for("share");
			const mediaById = new Map(mediaRows.map((row) => [row.id, row]));
			const requestedRegionIds = [
				...new Set(
					records.flatMap((record) =>
						record.regionId ? [record.regionId] : [],
					),
				),
			];
			const existingRegionRows =
				requestedRegionIds.length === 0
					? []
					: await transaction
							.select({
								id: mediaRegions.id,
								mediaId: mediaRegions.mediaId,
								kind: mediaRegions.kind,
								sourceRevision: mediaRegions.sourceRevision,
							})
							.from(mediaRegions)
							.where(inArray(mediaRegions.id, requestedRegionIds))
							.for("share");
			const existingRegionById = new Map(
				existingRegionRows.map((region) => [region.id, region]),
			);
			const preparedRecords = await Promise.all(
				records.map(async (record) => {
					const media = mediaById.get(record.mediaId);
					if (!media || media.mediaSourceId !== record.mediaSourceId) {
						throw new Error(
							`CCIP media is missing or changed source: ${record.mediaId}`,
						);
					}
					const currentSourceRevision = await createMediaSourceRevision({
						mediaId: media.id,
						mediaSourceId: media.mediaSourceId,
						modifiedAt: media.modifiedAt,
						fileSize: media.fileSize,
						width: media.width,
						height: media.height,
					});
					const sourceRevision = requireCurrentRevision
						? currentSourceRevision
						: await createMediaSourceRevision({
								mediaId: media.id,
								mediaSourceId: media.mediaSourceId,
								modifiedAt: record.mediaModifiedAt,
								fileSize: media.fileSize,
								width: media.width,
								height: media.height,
							});
					const expectedInputRevision =
						await createCcipEmbeddingInputRevision({
							sourceRevision,
							model: record.model,
							embeddingVersion: record.embeddingVersion,
							preprocessingProfile: record.preprocessingProfile,
						});
					if (
						requireCurrentRevision &&
						record.inputRevision !== expectedInputRevision
					) {
						throw new Error(
							`CCIP input revision changed before commit: ${record.mediaId} (expected ${expectedInputRevision}, received ${record.inputRevision})`,
						);
					}
					if (record.regionId) {
						const existingRegion = existingRegionById.get(record.regionId);
						if (
							existingRegion &&
							(existingRegion.mediaId !== record.mediaId ||
								existingRegion.kind !== record.regionKind)
						) {
							throw new Error(`CCIP region identity mismatch: ${record.regionId}`);
						}
						if (!existingRegion && record.regionKind !== "full") {
							throw new Error(`CCIP region does not exist: ${record.regionId}`);
						}
						if (
							requireCurrentRevision &&
							existingRegion &&
							existingRegion.sourceRevision !== currentSourceRevision
						) {
							throw new Error(`CCIP region is stale: ${record.regionId}`);
						}
					}
					return {
						record,
						media,
						sourceRevision,
						inputRevision: expectedInputRevision,
					};
				}),
			);
			const fullRegionByMediaId = new Map<
				string,
				(typeof preparedRecords)[number]
			>();
			for (const prepared of preparedRecords) {
				if (prepared.record.regionKind !== "full") continue;
				const current = fullRegionByMediaId.get(prepared.record.mediaId);
				if (
					!current ||
					prepared.record.mediaModifiedAt.getTime() >=
						current.record.mediaModifiedAt.getTime()
				) {
					fullRegionByMediaId.set(prepared.record.mediaId, prepared);
				}
			}
			const regionValues = await Promise.all(
				[...fullRegionByMediaId.values()].map(async (prepared) => ({
					id: prepared.record.regionId ?? undefined,
					mediaId: prepared.record.mediaId,
					kind: "full" as const,
					sourceModifiedAt: prepared.record.mediaModifiedAt,
					sourceWidth: prepared.media.width,
					sourceHeight: prepared.media.height,
					sourceRevision: prepared.sourceRevision,
					regionRevision: await createMediaRegionRevision({
						sourceRevision: prepared.sourceRevision,
						kind: "full",
						x: null,
						y: null,
						width: null,
						height: null,
						label: null,
						detector: null,
						detectorModel: null,
						detectorVersion: null,
						manualReason: null,
					}),
					updatedAt: now,
				})),
			);
			const regions =
				regionValues.length === 0
					? []
					: await transaction
							.insert(mediaRegions)
							.values(regionValues)
							.onConflictDoUpdate({
								target: mediaRegions.mediaId,
								targetWhere: sql`${mediaRegions.kind} = 'full'`,
								set: {
									sourceModifiedAt: sql`CASE WHEN excluded.source_modified_at >= ${mediaRegions.sourceModifiedAt} THEN excluded.source_modified_at ELSE ${mediaRegions.sourceModifiedAt} END`,
									sourceWidth: sql`CASE WHEN excluded.source_modified_at >= ${mediaRegions.sourceModifiedAt} THEN excluded.source_width ELSE ${mediaRegions.sourceWidth} END`,
									sourceHeight: sql`CASE WHEN excluded.source_modified_at >= ${mediaRegions.sourceModifiedAt} THEN excluded.source_height ELSE ${mediaRegions.sourceHeight} END`,
									sourceRevision: sql`CASE WHEN excluded.source_modified_at >= ${mediaRegions.sourceModifiedAt} THEN excluded.source_revision ELSE ${mediaRegions.sourceRevision} END`,
									regionRevision: sql`CASE WHEN excluded.source_modified_at >= ${mediaRegions.sourceModifiedAt} THEN excluded.region_revision ELSE ${mediaRegions.regionRevision} END`,
									updatedAt: sql`CASE WHEN excluded.source_modified_at >= ${mediaRegions.sourceModifiedAt} THEN excluded.updated_at ELSE ${mediaRegions.updatedAt} END`,
								},
							})
							.returning();
			const regionIdByMediaId = new Map(
				regions.map((region) => [region.mediaId, region.id]),
			);
			const embeddingsByKey = new Map<
				string,
				{
					record: CcipVectorRecord;
					regionId: string;
					inputRevision: string;
				}
			>();
			for (const prepared of preparedRecords) {
				const regionId =
					prepared.record.regionKind === "full"
						? regionIdByMediaId.get(prepared.record.mediaId)
						: prepared.record.regionId;
				if (!regionId) {
					throw new Error(
						`Unable to resolve CCIP region for media ${prepared.record.mediaId}`,
					);
				}
				const key = `${regionId}:${prepared.record.model}:${prepared.record.embeddingVersion}:${prepared.record.preprocessingProfile}`;
				const existing = embeddingsByKey.get(key);
				if (
					!existing ||
					prepared.record.extractedAt.getTime() >
						existing.record.extractedAt.getTime()
				) {
					embeddingsByKey.set(key, {
						record: prepared.record,
						regionId,
						inputRevision: prepared.inputRevision,
					});
				}
			}
			const embeddings = [...embeddingsByKey.values()].map(
				({ record, regionId, inputRevision }) => ({
					regionId,
					embedding: record.vector,
					model: record.model,
					embeddingVersion: record.embeddingVersion,
					mediaModifiedAt: record.mediaModifiedAt,
					inputRevision,
					preprocessingProfile: record.preprocessingProfile,
					extractedAt: record.extractedAt,
					updatedAt: now,
				}),
			);
			await transaction
				.insert(ccipEmbeddings)
				.values(embeddings)
				.onConflictDoUpdate({
					target: [
						ccipEmbeddings.regionId,
						ccipEmbeddings.model,
						ccipEmbeddings.embeddingVersion,
						ccipEmbeddings.preprocessingProfile,
					],
					set: {
						embedding: sql`
							CASE
								WHEN excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.embedding
								ELSE ${ccipEmbeddings.embedding}
							END
						`,
						mediaModifiedAt: sql`
							CASE
								WHEN excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.media_modified_at
								ELSE ${ccipEmbeddings.mediaModifiedAt}
							END
						`,
						inputRevision: sql`
							CASE
								WHEN excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.input_revision
								ELSE ${ccipEmbeddings.inputRevision}
							END
						`,
						preprocessingProfile: sql`
							CASE
								WHEN excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.preprocessing_profile
								ELSE ${ccipEmbeddings.preprocessingProfile}
							END
						`,
						extractedAt: sql`
							CASE
								WHEN excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.extracted_at
								ELSE ${ccipEmbeddings.extractedAt}
							END
						`,
						updatedAt: sql`
							CASE
								WHEN excluded.extracted_at > ${ccipEmbeddings.extractedAt}
								THEN excluded.updated_at
								ELSE ${ccipEmbeddings.updatedAt}
							END
						`,
					},
				});
		});
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

	async deleteRegion(regionId: string): Promise<void> {
		await this.database
			.delete(ccipEmbeddings)
			.where(eq(ccipEmbeddings.regionId, regionId));
	}

	async deleteEmbedding(key: CcipEmbeddingKey): Promise<void> {
		await this.database.delete(ccipEmbeddings).where(
			and(
				eq(ccipEmbeddings.regionId, key.regionId),
				eq(ccipEmbeddings.model, key.model),
				eq(ccipEmbeddings.embeddingVersion, key.embeddingVersion),
				eq(
					ccipEmbeddings.preprocessingProfile,
					key.preprocessingProfile,
				),
			),
		);
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
			query?.regionId
				? sql`${mediaRegions.id} = ${query.regionId}`
				: undefined,
			query?.regionKind
				? sql`${mediaRegions.kind} = ${query.regionKind}`
				: sql`${mediaRegions.kind} = ${FULL_REGION_KIND}`,
			query?.mediaSourceId
				? sql`${medias.mediaSourceId} = ${query.mediaSourceId}`
				: undefined,
			query?.model ? sql`${ccipEmbeddings.model} = ${query.model}` : undefined,
			query?.embeddingVersion !== undefined
				? sql`${ccipEmbeddings.embeddingVersion} = ${query.embeddingVersion}`
				: undefined,
			query?.preprocessingProfile
				? sql`${ccipEmbeddings.preprocessingProfile} = ${query.preprocessingProfile}`
				: undefined,
		].filter((value): value is SQL => value !== undefined);
		const startedAt = performance.now();
		const raw = await this.database.execute(sql`
			SELECT
				${mediaRegions.id} AS "regionId",
				${mediaRegions.kind} AS "regionKind",
				${medias.id} AS "mediaId",
				${medias.mediaSourceId} AS "mediaSourceId",
				${ccipEmbeddings.embedding}::text AS "vector",
				${ccipEmbeddings.model} AS "model",
				${ccipEmbeddings.embeddingVersion} AS "embeddingVersion",
				${ccipEmbeddings.mediaModifiedAt} AS "mediaModifiedAt",
				${ccipEmbeddings.inputRevision} AS "inputRevision",
				${ccipEmbeddings.preprocessingProfile} AS "preprocessingProfile",
				${ccipEmbeddings.extractedAt} AS "extractedAt",
				(${ccipEmbeddings.embedding} <=> ${literal}::vector) AS "cosineDistance"
			FROM ${ccipEmbeddings}
			INNER JOIN ${mediaRegions} ON ${ccipEmbeddings.regionId} = ${mediaRegions.id}
			INNER JOIN ${medias} ON ${mediaRegions.mediaId} = ${medias.id}
			WHERE ${sql.join(filters, sql` AND `)}
			ORDER BY ${ccipEmbeddings.embedding} <=> ${literal}::vector
			LIMIT ${limit}
		`);
		const candidates = extractRows(raw).map((row) =>
			rawCandidateRowSchema.parse(row),
		);
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
