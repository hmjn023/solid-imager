import { ProcessingManagementService } from "@solid-imager/application/services/processing-management-service";
import { getMediaTaskRevision } from "@solid-imager/application/services/media-task-service";
import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { processingSettingsFromConfig } from "@solid-imager/core/domain/processing/schemas";
import { createProcessingManagementRepository } from "@solid-imager/db/repositories/processing-management-repository";
import { getExecutor } from "~/infrastructure/db/executor";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { services } from "~/infrastructure/service-registry";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { taggingService } from "./tagging-service";
import { ccipVectorService } from "./ccip-vector-service";
import { logger } from "~/infrastructure/logger";

export function getProcessingManagementService() {
	return new ProcessingManagementService({
		targets: createProcessingManagementRepository(getExecutor),
		states: MediaProcessingStateRepository,
		mediaRepo: services.getMediaRepository(),
		transactions: DrizzleTransactionManager,
		logger,
		revision: (input, kind) =>
			kind === "tagging"
				? getTaggingTaskRevision(
						input,
						services.getAiClient().getTaggingSettings(),
					)
				: kind === "ccip"
					? getCcipTaskRevision(input, services.getAiClient().getCcipSettings())
					: getMediaTaskRevision(
							input,
							kind,
							processingSettingsFromConfig(
								services.getConfigService().getConfig(),
							),
						),
		request: async (sourceId, mediaId, kind, tx) => {
			if (kind === "tagging")
				await taggingService.requestTags(sourceId, mediaId, true, tx);
			else if (kind === "ccip")
				await ccipVectorService.requestExtraction(sourceId, mediaId, true, tx);
			else
				await services
					.getMediaProcessingService()
					.requestTask(sourceId, mediaId, kind, true, tx);
		},
		notify: (input, kind) =>
			RealtimeEventBus.publishSource(
				input.mediaSourceId,
				"media-processing-changed",
				{ mediaId: input.mediaId, kind },
			),
	});
}
