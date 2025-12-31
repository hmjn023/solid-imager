import { os } from "@orpc/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { ResourceNotFoundError } from "~/domain/errors";
import {
  mediaSearchRequestSchema,
  updateMediaRequestSchema,
} from "~/domain/media/schemas";

/**
 * Media Router Implementation
 */
export const mediaRouter = {
  /**
   * Search media in a source
   */
  search: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        params: mediaSearchRequestSchema,
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.searchMedia(input.sourceId, input.params)
    ),

  /**
   * Get a specific media file
   */
  get: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const media = await MediaService.getMedia(input.sourceId, input.mediaId);
      if (!media) {
        throw new Error(`Media not found: ${input.mediaId}`);
      }
      return media;
    }),

  /**
   * Get media file content (binary)
   * Note: This returns the actual image/video file
   */
  getContent: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const imageBuffer = await MediaService.getMediaContent(
        input.sourceId,
        input.mediaId
      );
      // oRPC doesn't handle binary data well, so we'll keep this as REST for now
      // This endpoint will remain as /api/sources/:id/:mediaId
      return imageBuffer;
    }),

  /**
   * Update media metadata
   */
  update: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
        data: updateMediaRequestSchema,
      })
    )
    .handler(async ({ input }) => {
      try {
        return await MediaService.updateMedia(
          input.sourceId,
          input.mediaId,
          input.data
        );
      } catch (error) {
        if (error instanceof ResourceNotFoundError) {
          throw new Error(`Media not found: ${input.mediaId}`);
        }
        throw error;
      }
    }),

  /**
   * Delete a media file
   */
  delete: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      try {
        await MediaService.deleteMedia(input.sourceId, input.mediaId);
        return { success: true };
      } catch (error) {
        if (error instanceof ResourceNotFoundError) {
          throw new Error(`Media not found: ${input.mediaId}`);
        }
        throw error;
      }
    }),
};
