import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { MediaRegion } from "@solid-imager/core/domain/media-regions/schemas";
import type {
	CreateMaterializedMedia,
	IMediaRegionRepository,
	NewMediaRegion,
} from "@solid-imager/core/domain/repositories/media-region-repository";
import { and, eq, isNotNull, ne, notInArray, sql } from "drizzle-orm";
import { mediaRegions, mediaRelationsTable, medias } from "../schema";
import type { DrizzleExecutor } from "../types";

type DbMediaRegion = typeof mediaRegions.$inferSelect;
type DbMedia = typeof medias.$inferSelect;

function mapMediaRegion(row: DbMediaRegion): MediaRegion {
	return {
		id: row.id,
		mediaId: row.mediaId,
		kind: row.kind,
		x: row.x,
		y: row.y,
		width: row.width,
		height: row.height,
		sourceWidth: row.sourceWidth,
		sourceHeight: row.sourceHeight,
		sourceModifiedAt: row.sourceModifiedAt,
		sourceRevision: row.sourceRevision,
		regionRevision: row.regionRevision,
		label: row.label,
		manualReason: row.manualReason,
		detectionKey: row.detectionKey,
		detector: row.detector,
		detectorModel: row.detectorModel,
		detectorVersion: row.detectorVersion,
		score: row.score,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function mapMedia(row: DbMedia): Media {
	return {
		id: row.id,
		mediaSourceId: row.mediaSourceId,
		filePath: row.filePath,
		fileName: row.fileName,
		mediaType: row.mediaType,
		width: row.width,
		height: row.height,
		fileSize: row.fileSize,
		description: row.description,
		createdAt: row.createdAt,
		modifiedAt: row.modifiedAt,
		indexedAt: row.indexedAt,
		status: row.status,
	};
}

function toInsert(data: NewMediaRegion) {
	return {
		mediaId: data.mediaId,
		kind: data.kind,
		x: data.bbox.x,
		y: data.bbox.y,
		width: data.bbox.width,
		height: data.bbox.height,
		sourceWidth: data.sourceWidth,
		sourceHeight: data.sourceHeight,
		sourceModifiedAt: data.sourceModifiedAt,
		sourceRevision: data.sourceRevision,
		regionRevision: data.regionRevision,
		label: data.label,
		manualReason: data.manualReason,
		detectionKey: data.detectionKey,
		detector: data.detector,
		detectorModel: data.detectorModel,
		detectorVersion: data.detectorVersion,
		score: data.score,
		updatedAt: new Date(),
	};
}

async function findMaterialized(
	client: DrizzleExecutor,
	derivationKey: string,
): Promise<Media | null> {
	const [row] = await client
		.select({ media: medias })
		.from(mediaRelationsTable)
		.innerJoin(medias, eq(mediaRelationsTable.childMediaId, medias.id))
		.where(eq(mediaRelationsTable.derivationKey, derivationKey))
		.limit(1);
	return row ? mapMedia(row.media) : null;
}

async function insertMaterialized(
	client: DrizzleExecutor,
	data: CreateMaterializedMedia,
): Promise<Media> {
	const existing = await findMaterialized(client, data.derivationKey);
	if (existing) {
		return existing;
	}
	const [created] = await client
		.insert(medias)
		.values({
			mediaSourceId: data.media.mediaSourceId,
			filePath: data.media.filePath,
			fileName: data.media.fileName,
			mediaType: data.media.mediaType,
			width: data.media.width,
			height: data.media.height,
			fileSize: data.media.fileSize,
			description: data.media.description,
			createdAt: data.media.createdAt,
			modifiedAt: data.media.modifiedAt,
		})
		.returning();
	if (!created) {
		throw new Error("Failed to create materialized media.");
	}
	await client.insert(mediaRelationsTable).values({
		parentMediaId: data.parentMediaId,
		childMediaId: created.id,
		relationType: "derivative",
		sourceRegionId: data.sourceRegionId,
		derivationKey: data.derivationKey,
		metadata: data.snapshot,
	});
	return mapMedia(created);
}

export function createMediaRegionRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): IMediaRegionRepository {
	return {
		async findByMediaId(mediaId, tx) {
			const rows = await getExecutor(tx)
				.select()
				.from(mediaRegions)
				.where(
					and(eq(mediaRegions.mediaId, mediaId), ne(mediaRegions.kind, "full")),
				)
				.orderBy(mediaRegions.createdAt);
			return rows.map(mapMediaRegion);
		},

		async findById(id, tx) {
			const [row] = await getExecutor(tx)
				.select()
				.from(mediaRegions)
				.where(eq(mediaRegions.id, id))
				.limit(1);
			return row ? mapMediaRegion(row) : null;
		},

		async create(data, tx) {
			const [row] = await getExecutor(tx)
				.insert(mediaRegions)
				.values(toInsert(data))
				.returning();
			if (!row) {
				throw new Error("Failed to create media region.");
			}
			return mapMediaRegion(row);
		},

		async upsertDetected(data, tx) {
			if (!data.detectionKey) {
				throw new Error("Detected regions require a detection key.");
			}
			const insert = toInsert(data);
			const [row] = await getExecutor(tx)
				.insert(mediaRegions)
				.values(insert)
				.onConflictDoUpdate({
					target: [mediaRegions.mediaId, mediaRegions.detectionKey],
					targetWhere: sql`${mediaRegions.detectionKey} IS NOT NULL`,
					set: {
						kind: insert.kind,
						x: insert.x,
						y: insert.y,
						width: insert.width,
						height: insert.height,
						sourceWidth: insert.sourceWidth,
						sourceHeight: insert.sourceHeight,
						sourceModifiedAt: insert.sourceModifiedAt,
						sourceRevision: insert.sourceRevision,
						regionRevision: insert.regionRevision,
						label: insert.label,
						manualReason: insert.manualReason,
						detector: insert.detector,
						detectorModel: insert.detectorModel,
						detectorVersion: insert.detectorVersion,
						score: insert.score,
						updatedAt: insert.updatedAt,
					},
				})
				.returning();
			if (!row) {
				throw new Error("Failed to persist detected media region.");
			}
			return mapMediaRegion(row);
		},

		async deleteDetectedNotIn(mediaId, detectionKeys, tx) {
			const base = and(
				eq(mediaRegions.mediaId, mediaId),
				eq(mediaRegions.kind, "person"),
				isNotNull(mediaRegions.detectionKey),
			);
			await getExecutor(tx)
				.delete(mediaRegions)
				.where(
					detectionKeys.length > 0
						? and(base, notInArray(mediaRegions.detectionKey, detectionKeys))
						: base,
				);
		},

		async update(id, expectedRevision, data, tx) {
			const update: Partial<typeof mediaRegions.$inferInsert> = {
				regionRevision: data.regionRevision,
				updatedAt: data.updatedAt,
			};
			if (data.bbox) {
				update.x = data.bbox.x;
				update.y = data.bbox.y;
				update.width = data.bbox.width;
				update.height = data.bbox.height;
			}
			if (data.kind !== undefined) update.kind = data.kind;
			if (data.label !== undefined) update.label = data.label;
			if (data.manualReason !== undefined) {
				update.manualReason = data.manualReason;
			}
			if (data.detectionKey !== undefined) {
				update.detectionKey = data.detectionKey;
			}
			const [row] = await getExecutor(tx)
				.update(mediaRegions)
				.set(update)
				.where(
					and(
						eq(mediaRegions.id, id),
						eq(mediaRegions.regionRevision, expectedRevision),
					),
				)
				.returning();
			return row ? mapMediaRegion(row) : null;
		},

		async delete(id, expectedRevision, tx) {
			const rows = await getExecutor(tx)
				.delete(mediaRegions)
				.where(
					and(
						eq(mediaRegions.id, id),
						eq(mediaRegions.regionRevision, expectedRevision),
					),
				)
				.returning();
			return rows.length > 0;
		},

		findMaterializedByDerivationKey(derivationKey, tx) {
			return findMaterialized(getExecutor(tx), derivationKey);
		},

		async createMaterialized(data, tx) {
			if (tx) {
				return insertMaterialized(getExecutor(tx), data);
			}
			return getExecutor().transaction(async (transaction) =>
				insertMaterialized(transaction, data),
			);
		},
	};
}
