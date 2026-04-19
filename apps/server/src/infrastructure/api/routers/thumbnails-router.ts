import { os } from "@orpc/server";
import { z } from "zod";
import { ThumbnailService } from "~/application/services/thumbnail-service";

/**
 * Thumbnails Router Implementation
 */
export const thumbnailsRouter = {
	/**
	 * Generates thumbnails for all media in a source
	 */
	generate: os
		.input(z.object({ sourceId: z.string().uuid() }))
		.handler(async ({ input }) => await ThumbnailService.startThumbnailGeneration(input.sourceId)),

	/**
	 * Clears the thumbnail cache for a specific source
	 */
	clear: os
		.input(z.object({ sourceId: z.string().uuid() }))
		.handler(async ({ input }) => await ThumbnailService.clearThumbnailCache(input.sourceId)),
};
