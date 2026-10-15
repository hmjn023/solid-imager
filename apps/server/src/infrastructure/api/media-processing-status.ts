import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { getMediaTaskRevision } from "@solid-imager/application/services/media-task-service";
import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import {
	mediaTaskKindSchema,
	isMediaTaskApplicable,
	processingSettingsFromConfig,
} from "@solid-imager/core/domain/processing/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { MEDIA_PROCESSING_LEASE_MS } from "@solid-imager/db/repositories/media-processing-state-repository";
import { eq, inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
	medias,
	mediaSources,
	mediaProcessingStates,
} from "~/infrastructure/db/schema";
import { services } from "~/infrastructure/service-registry";

/** Public projection only: never expose paths, revisions, claim tokens or raw errors. */
export async function findCurrentProcessingSteps(mediaIds: string[]) {
	const result = new Map<
		string,
		NonNullable<JobDto["currentProcessingSteps"]>
	>();
	if (!mediaIds.length) return result;
	const rows = await db
		.select({
			media: medias,
			source: mediaSources,
			state: mediaProcessingStates,
		})
		.from(medias)
		.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
		.leftJoin(
			mediaProcessingStates,
			eq(mediaProcessingStates.mediaId, medias.id),
		)
		.where(inArray(medias.id, mediaIds));
	const settings = processingSettingsFromConfig(
		services.getConfigService().getConfig(),
	);
	for (const { media, source, state } of rows) {
		const connection = localConnectionSchema.safeParse(source.connectionInfo);
		if (source.type !== "local" || !connection.success) continue;
		if (!result.has(media.id))
			result.set(
				media.id,
				mediaTaskKindSchema.options.map((kind) => ({
					kind,
					status: isMediaTaskApplicable(media.mediaType, kind)
						? "pending"
						: "skipped",
					attemptCount: 0,
					updatedAt: null,
				})),
			);
		const kind = mediaTaskKindSchema.safeParse(state?.taskKind);
		if (!state || !kind.success) continue;
		const input = {
			mediaId: media.id,
			mediaSourceId: media.mediaSourceId,
			sourcePath: connection.data.path,
			filePath: media.filePath,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
			mediaType: media.mediaType,
		};
		const revision =
			kind.data === "tagging"
				? getTaggingTaskRevision(
						input,
						services.getAiClient().getTaggingSettings(),
					)
				: kind.data === "ccip"
					? getCcipTaskRevision(input, services.getAiClient().getCcipSettings())
					: getMediaTaskRevision(input, kind.data, settings);
		const step = result
			.get(media.id)
			?.find((entry) => entry.kind === kind.data);
		if (
			!step ||
			step.status === "skipped" ||
			revision !== state.requestedRevision
		)
			continue;
		const active =
			state.heartbeatAt &&
			Date.now() - state.heartbeatAt.getTime() < MEDIA_PROCESSING_LEASE_MS;
		step.status =
			state.status === "completed"
				? "completed"
				: state.status === "failed"
					? "failed"
					: state.status === "in_progress" && active
						? "in_progress"
						: "pending";
		step.attemptCount = state.attemptCount;
		step.updatedAt = state.updatedAt.toISOString();
	}
	return result;
}
