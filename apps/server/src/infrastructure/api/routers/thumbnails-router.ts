import { implement } from "@orpc/server";
import { thumbnailsContract } from "@solid-imager/core/domain/contract/thumbnails.contract";
import { ThumbnailService } from "~/infrastructure/services/thumbnail-service";

/**
 * Thumbnails Router Implementation
 */
const os = implement(thumbnailsContract);

export const thumbnailsRouter = os.router({
	/**
	 * Generates thumbnails for all media in a source
	 */
	generate: os.generate.handler(
		async ({ input }) =>
			await ThumbnailService.startThumbnailGeneration(input.sourceId, {
				size: input.size,
				missingOnly: input.missingOnly,
			}),
	),

	/**
	 * Clears the thumbnail cache for a specific source
	 */
	clear: os.clear.handler(
		async ({ input }) =>
			await ThumbnailService.clearThumbnailCache(input.sourceId),
	),
});
