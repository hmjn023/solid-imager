import {
	canReuseTaggingResult,
	getTaggingTaskRevision,
} from "@solid-imager/application/services/tagging-task-service";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { taggingResponseSchema } from "@solid-imager/core/domain/tagging/schemas";
import { and, asc, eq, gt, notExists, sql } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
	jobs,
	medias,
	mediaSources,
	mediaProcessingStates,
} from "~/infrastructure/db/schema";
import { services } from "~/infrastructure/service-registry";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import type { TaggingProcessingSettings } from "@solid-imager/core/domain/processing/schemas";

/** A bounded scan shared by the target count and dispatch; legacy AI associations are not cache proof. */
export async function scanTaggingTargetPage(
	options: {
		mediaSourceId?: string;
		force: boolean;
		limit: number;
		afterId?: string;
		parentId?: string;
	},
	queryDb: DrizzleExecutor = db,
	settings: TaggingProcessingSettings = services
		.getAiClient()
		.getTaggingSettings(),
) {
	const existingChild = options.parentId
		? queryDb
				.select({ id: jobs.id })
				.from(jobs)
				.where(
					and(
						eq(jobs.parentId, options.parentId),
						eq(jobs.type, "auto_tagging"),
						sql`${jobs.payload}->>'mediaId' = ${medias.id}::text`,
					),
				)
		: undefined;
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
				eq(mediaProcessingStates.taskKind, "tagging"),
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
				existingChild ? notExists(existingChild) : undefined,
			),
		)
		.orderBy(asc(medias.id))
		.limit(options.limit);
	const targets = rows
		.filter(({ media, source, state }) => {
			const connection = localConnectionSchema.safeParse(source.connectionInfo);
			if (!connection.success) return false;
			if (options.force || !canReuseTaggingResult(settings)) return true;
			const revision = getTaggingTaskRevision(
				{
					mediaId: media.id,
					mediaSourceId: media.mediaSourceId,
					sourcePath: connection.data.path,
					filePath: media.filePath,
					fileSize: media.fileSize,
					modifiedAt: media.modifiedAt,
					mediaType: media.mediaType,
				},
				settings,
			);
			return (
				state?.status !== "completed" ||
				state.completedRevision !== revision ||
				state.requestedRevision !== revision ||
				!taggingResponseSchema.safeParse(state.taggingResult).success
			);
		})
		.map(({ media }) => ({ id: media.id, mediaSourceId: media.mediaSourceId }));
	return { targets, nextCursor: rows.at(-1)?.media.id };
}
