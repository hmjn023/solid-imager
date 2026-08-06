import { os } from "@orpc/server";
import {
	generateThumbnailsRequestSchema,
	generateThumbnailsResponseSchema,
} from "@solid-imager/core/domain/thumbnails/schemas";
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
		.input(generateThumbnailsRequestSchema)
		.output(generateThumbnailsResponseSchema)
		.handler(
			async ({ input }) =>
				await ThumbnailService.startThumbnailGeneration(input.sourceId, {
					size: input.size,
					missingOnly: input.missingOnly,
				}),
		),

	/**
	 * Clears the thumbnail cache for a specific source
	 */
	clear: os
		.input(z.object({ sourceId: z.string().uuid() }))
		.handler(
			async ({ input }) =>
				await ThumbnailService.clearThumbnailCache(input.sourceId),
		),
};
