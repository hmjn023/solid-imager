import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	MediaProcessingInput,
	ProcessingListRequest,
} from "@solid-imager/core/domain/processing/schemas";
import type { IProcessingManagementRepository } from "@solid-imager/core/domain/repositories/processing-management-repository";
import {
	and,
	asc,
	or,
	ne,
	count,
	desc,
	eq,
	exists,
	gt,
	ilike,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { isRecord } from "@solid-imager/core/utils/type-guards";
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
		async scanPage(input, tx) {
			const db = getExecutor(tx);
			let before = input.cursor?.before;
			if (!before) {
				const result: unknown = await db.execute(
					sql`SELECT to_char(timezone('UTC', clock_timestamp()), 'YYYY-MM-DD"T"HH24:MI:SS.US') AS before`,
				);
				const rows = Array.isArray(result)
					? result
					: isRecord(result) && Array.isArray(result.rows)
						? result.rows
						: [];
				before = z.object({ before: z.string() }).parse(rows[0]).before;
			}
			const rows = await db
				.select({
					...fields,
					queued: sql<boolean>`EXISTS (SELECT 1 FROM batch_items bi JOIN batch_runs br ON br.id = bi.run_id WHERE bi.media_id = ${medias.id} AND bi.kind = ${input.kind} AND bi.status IN ('pending','scheduled') AND br.status IN ('pending','in_progress') AND br.cancel_requested_at IS NULL)`,
				})
				.from(medias)
				.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
				.where(
					and(
						validTarget,
						input.kind === "thumbnail"
							? ne(medias.mediaType, "audio")
							: eq(medias.mediaType, "image"),
						input.mediaSourceId
							? eq(medias.mediaSourceId, input.mediaSourceId)
							: undefined,
						input.query
							? ilike(
									medias.fileName,
									`%${input.query.replace(/[\\%_]/g, "\\$&")}%`,
								)
							: undefined,
						sql`${medias.indexedAt} <= ${before}::timestamp`,
						input.cursor ? gt(medias.id, input.cursor.afterId) : undefined,
					),
				)
				.orderBy(asc(medias.id))
				.limit(101);
			const page = rows.slice(0, 100);
			return {
				items: page.map((row) => ({ ...map(row), queued: row.queued })),
				cursor:
					rows.length > 100
						? { before, afterId: page[page.length - 1].mediaId }
						: null,
			};
		},
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
				input.status === "not_requested"
					? sql`EXISTS (SELECT 1 FROM (VALUES ('metadata'),('thumbnail'),('tagging'),('ccip')) AS task(kind)
						WHERE (${medias.mediaType} = 'image' OR (task.kind = 'thumbnail' AND ${medias.mediaType} <> 'audio'))
						${input.kind ? sql`AND task.kind = ${input.kind}` : sql``}
						AND NOT EXISTS (SELECT 1 FROM media_processing_states s WHERE s.media_id = ${medias.id} AND s.task_kind = task.kind))`
					: input.status
						? exists(
								db
									.select({ id: mediaProcessingStates.mediaId })
									.from(mediaProcessingStates)
									.where(
										and(
											eq(mediaProcessingStates.mediaId, medias.id),
											eq(mediaProcessingStates.status, input.status),
											input.kind
												? eq(mediaProcessingStates.taskKind, input.kind)
												: undefined,
											or(
												eq(medias.mediaType, "image"),
												and(
													eq(mediaProcessingStates.taskKind, "thumbnail"),
													ne(medias.mediaType, "audio"),
												),
											),
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
