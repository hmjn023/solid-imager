import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	MediaProcessingInput,
	ProcessingListRequest,
} from "@solid-imager/core/domain/processing/schemas";
import type { IProcessingManagementRepository } from "@solid-imager/core/domain/repositories/processing-management-repository";
import { and, count, desc, eq, exists, ilike, sql } from "drizzle-orm";
import { medias, mediaSources, mediaProcessingStates } from "../schema";
import type { DrizzleExecutor } from "../types";

export function createProcessingManagementRepository(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
): IProcessingManagementRepository {
	const fields = {
		mediaId: medias.id,
		mediaSourceId: medias.mediaSourceId,
		fileName: medias.fileName,
		sourceName: mediaSources.name,
		filePath: medias.filePath,
		mediaType: medias.mediaType,
		modifiedAt: medias.modifiedAt,
		fileSize: medias.fileSize,
		sourcePath: sql<string>`${mediaSources.connectionInfo}->>'path'`,
	};
	const validTarget = and(
		eq(mediaSources.type, "local"),
		eq(medias.status, "active"),
		sql`jsonb_typeof(${mediaSources.connectionInfo}->'path') = 'string' AND length(${mediaSources.connectionInfo}->>'path') > 0`,
	);
	const map = (
		row: MediaProcessingInput & { fileName: string; sourceName: string },
	) => ({
		fileName: row.fileName,
		sourceName: row.sourceName,
		input: {
			mediaId: row.mediaId,
			mediaSourceId: row.mediaSourceId,
			sourcePath: row.sourcePath,
			filePath: row.filePath,
			mediaType: row.mediaType,
			modifiedAt: row.modifiedAt,
			fileSize: row.fileSize,
		},
	});
	return {
		async list(input: ProcessingListRequest) {
			const db = getExecutor();
			const where = and(
				validTarget,
				input.mediaSourceId
					? eq(medias.mediaSourceId, input.mediaSourceId)
					: undefined,
				input.query
					? ilike(
							medias.fileName,
							`%${input.query.replace(/[\\%_]/g, "\\$&")}%`,
						)
					: undefined,
				input.status
					? exists(
							db
								.select({ id: mediaProcessingStates.mediaId })
								.from(mediaProcessingStates)
								.where(
									and(
										eq(mediaProcessingStates.mediaId, medias.id),
										eq(mediaProcessingStates.status, input.status),
									),
								),
						)
					: undefined,
			);
			const [rows, totals] = await Promise.all([
				db
					.select(fields)
					.from(medias)
					.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
					.where(where)
					.orderBy(desc(medias.indexedAt), desc(medias.id))
					.limit(input.limit)
					.offset(input.offset),
				db
					.select({ total: count() })
					.from(medias)
					.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
					.where(where),
			]);
			return { items: rows.map(map), total: Number(totals[0]?.total ?? 0) };
		},
		async findByMediaId(mediaId, tx) {
			const [row] = await getExecutor(tx)
				.select(fields)
				.from(medias)
				.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
				.where(and(validTarget, eq(medias.id, mediaId)));
			return row ? map(row) : null;
		},
	};
}
