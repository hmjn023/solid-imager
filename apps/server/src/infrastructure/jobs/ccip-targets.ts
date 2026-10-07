import type { CcipVectorMetadata } from "@solid-imager/application/ports/ccip-vector-store";
import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { canReuseAiResult } from "@solid-imager/application/services/ai-media-task-service";
import type { CcipProcessingSettings } from "@solid-imager/core/domain/processing/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
	jobs,
	medias,
	mediaSources,
	mediaProcessingStates,
} from "~/infrastructure/db/schema";
import { services } from "~/infrastructure/service-registry";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";

/** Queue transport fallback until the worker creates the authoritative task state. */
export async function findQueuedCcipJob(
	mediaSourceId: string,
	mediaId: string,
	queryDb: DrizzleExecutor = db,
) {
	const [row] = await queryDb
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				eq(jobs.type, "extract_ccip_vector"),
				eq(jobs.mediaSourceId, mediaSourceId),
				inArray(jobs.status, ["pending", "in_progress"]),
				isNull(jobs.cancelRequestedAt),
				sql`(${jobs.payload}->>'mediaId' = ${mediaId} OR ${jobs.payload}->'mediaIds' @> ${JSON.stringify([mediaId])}::jsonb)`,
			),
		)
		.orderBy(desc(jobs.createdAt))
		.limit(1);
	return row ?? null;
}

/** Target counting and dispatch share a bounded, revision-aware scan. */
export async function scanCcipTargetPage(
	options: {
		mediaSourceId?: string;
		force: boolean;
		limit: number;
		afterId?: string;
	},
	queryDb: DrizzleExecutor = db,
	settings: CcipProcessingSettings = services.getAiClient().getCcipSettings(),
	loadMetadata: (ids: string[]) => Promise<Map<string, CcipVectorMetadata>> = (
		ids,
	) => ccipVectorService.getMetadataMany(ids),
) {
	const rows = await queryDb
		.select({
			media: medias,
			source: mediaSources,
			state: mediaProcessingStates,
		})
		.from(medias)
		.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
		.leftJoin(
			mediaProcessingStates,
			and(
				eq(mediaProcessingStates.mediaId, medias.id),
				eq(mediaProcessingStates.taskKind, "ccip"),
			),
		)
		.where(
			and(
				eq(medias.mediaType, "image"),
				eq(mediaSources.type, "local"),
				options.mediaSourceId
					? eq(medias.mediaSourceId, options.mediaSourceId)
					: undefined,
				options.afterId ? gt(medias.id, options.afterId) : undefined,
			),
		)
		.orderBy(asc(medias.id))
		.limit(options.limit);
	const metadata =
		options.force || !canReuseAiResult(settings)
			? new Map<string, CcipVectorMetadata>()
			: await loadMetadata(rows.map(({ media }) => media.id));
	const targets = rows
		.filter(({ media, source, state }) => {
			const connection = localConnectionSchema.safeParse(source.connectionInfo);
			if (!connection.success) return false;
			if (options.force || !canReuseAiResult(settings)) return true;
			const revision = getCcipTaskRevision(
				{
					mediaId: media.id,
					mediaSourceId: media.mediaSourceId,
					mediaType: media.mediaType,
					sourcePath: connection.data.path,
					filePath: media.filePath,
					modifiedAt: media.modifiedAt,
					fileSize: media.fileSize,
				},
				settings,
			);
			const record = metadata.get(media.id);
			return (
				state?.status !== "completed" ||
				state.requestedRevision !== revision ||
				state.completedRevision !== revision ||
				record?.processingRevision !== revision ||
				record.model !== settings.model ||
				record.embeddingVersion !== settings.embeddingVersion
			);
		})
		.map(({ media }) => ({ id: media.id, mediaSourceId: media.mediaSourceId }));
	return { targets, nextCursor: rows.at(-1)?.media.id };
}
