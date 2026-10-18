import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { ProcessingTarget } from "@solid-imager/core/domain/repositories/processing-management-repository";
import type {
	MediaProcessingInput,
	MediaTaskKind,
	ProcessingRecoveryReason,
} from "@solid-imager/core/domain/processing/schemas";
import {
	isMediaTaskApplicable,
	processingSettingsFromConfig,
} from "@solid-imager/core/domain/processing/schemas";
import { getMediaTaskRevision } from "@solid-imager/application/services/media-task-service";
import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { and, eq, inArray } from "drizzle-orm";
import { taggingResponseSchema } from "@solid-imager/core/domain/tagging/schemas";
import { getExecutor } from "~/infrastructure/db/executor";
import {
	mediaGenerationInfo,
	mediaProcessingStates,
} from "~/infrastructure/db/schema";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { services } from "~/infrastructure/service-registry";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";
import { thumbnailExists } from "./thumbnails";

export function createProcessingRecoveryInspector() {
	const tagging = services.getAiClient().getTaggingSettings();
	const ccip = services.getAiClient().getCcipSettings();
	const file = processingSettingsFromConfig(
		services.getConfigService().getConfig(),
	);
	const revision = (input: MediaProcessingInput, kind: MediaTaskKind) =>
		kind === "tagging"
			? getTaggingTaskRevision(input, tagging)
			: kind === "ccip"
				? getCcipTaskRevision(input, ccip)
				: getMediaTaskRevision(input, kind, file);
	return async (
		targets: (ProcessingTarget & { queued?: boolean })[],
		kind: MediaTaskKind,
		tx?: Transaction,
	) => {
		if (!targets.length) return [];
		const ids = targets.map((target) => target.input.mediaId);
		const db = getExecutor(tx);
		const metadata =
			kind === "metadata"
				? new Set(
						(
							await db
								.select({ mediaId: mediaGenerationInfo.mediaId })
								.from(mediaGenerationInfo)
								.where(inArray(mediaGenerationInfo.mediaId, ids))
						).map((row) => row.mediaId),
					)
				: null;
		const tags =
			kind === "tagging"
				? new Map(
						(
							await db
								.select({
									mediaId: mediaProcessingStates.mediaId,
									requestId: mediaProcessingStates.requestId,
									result: mediaProcessingStates.taggingResult,
								})
								.from(mediaProcessingStates)
								.where(
									and(
										inArray(mediaProcessingStates.mediaId, ids),
										eq(mediaProcessingStates.taskKind, "tagging"),
									),
								)
						).map((row) => [row.mediaId, row]),
					)
				: null;
		const states = await MediaProcessingStateRepository.findByMediaIds(
			targets.map((target) => target.input.mediaId),
			tx,
		);
		const vectors =
			kind === "ccip"
				? await ccipVectorService.getMetadataMany(
						targets.map((target) => target.input.mediaId),
						tx,
					)
				: null;
		const matches: {
			target: ProcessingTarget;
			reason: ProcessingRecoveryReason;
		}[] = [];
		for (const target of targets) {
			const input = target.input;
			if (target.queued || !isMediaTaskApplicable(input.mediaType, kind))
				continue;
			const state = states.find(
				(state) => state.mediaId === input.mediaId && state.taskKind === kind,
			);
			let reason: ProcessingRecoveryReason | undefined;
			if (!state) reason = "not_requested";
			else if (state.status === "failed") reason = "failed";
			else if (state.requestedRevision !== revision(input, kind))
				reason = "outdated";
			else if (state.status === "pending") {
				if (
					state.executionMode !== "scheduled" ||
					(await MediaProcessingStateRepository.isPendingRequestAbandoned(
						state,
						tx,
					))
				)
					reason = "abandoned";
			} else if (state.status === "completed") {
				if (state.completedRevision !== state.requestedRevision)
					reason = "outdated";
				else {
					const vector = vectors?.get(input.mediaId);
					const present =
						kind === "metadata"
							? metadata?.has(input.mediaId)
							: kind === "thumbnail"
								? (await thumbnailExists(
										input.mediaSourceId,
										input.mediaId,
										256,
									)) &&
									(await thumbnailExists(
										input.mediaSourceId,
										input.mediaId,
										512,
									))
								: kind === "tagging"
									? tags?.get(input.mediaId)?.requestId === state.requestId &&
										taggingResponseSchema.safeParse(
											tags?.get(input.mediaId)?.result,
										).success
									: vector?.processingRevision === state.requestedRevision &&
										vector.model === ccip.model &&
										vector.embeddingVersion === ccip.embeddingVersion;
					if (!present) reason = "missing_output";
				}
			}
			if (reason) matches.push({ target, reason });
		}
		return matches;
	};
}
