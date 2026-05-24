/**
 * MediaProcessingService - Thin proxy wrapping the extracted implementation
 */

import type { Media, MediaMetadataContext } from "@solid-imager/core/domain/media/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import { services } from "~/application/registry";

export { MediaProcessingServiceImpl } from "@solid-imager/application/services/media-processing-service";

export const MediaProcessingService = {
	registerAndProcess: async (
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	) => {
		return services
			.getMediaProcessingService()
			.registerAndProcess(mediaSourceId, relativePath, contextMetadata);
	},

	executeProcessMediaJob: async (job: any) => {
		return services.getMediaProcessingService().executeProcessMediaJob(job);
	},

	addContextMetadataToExistingMedia: async (
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	) => {
		return services
			.getMediaProcessingService()
			.addContextMetadataToExistingMedia(mediaId, context, tx);
	},
};
