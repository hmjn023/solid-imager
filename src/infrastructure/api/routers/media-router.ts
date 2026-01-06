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
   * Get media details (with tags, category, IP, characters, etc.)
   */
  getDetails: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.getMediaDetails(input.sourceId, input.mediaId)
    ),

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
      const { buffer } = await MediaService.getMediaContent(
        input.sourceId,
        input.mediaId
      );
      // oRPC doesn't handle binary data well, so we'll keep this as REST for now
      // This endpoint will remain as /api/sources/:id/:mediaId
      return buffer;
    }),

  /**
   * Get tags for a media file
   */
  getTags: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.getMediaTags(input.sourceId, input.mediaId)
    ),

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

  /**
   * Copy a media item to another source
   */
  copy: os
    .input(
      z.object({
        mediaId: z.string().uuid(),
        targetSourceId: z.string().uuid(),
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.copyMedia(input.mediaId, input.targetSourceId)
    ),

  /**
   * Move a media item to another source
   */
  move: os
    .input(
      z.object({
        mediaId: z.string().uuid(),
        targetSourceId: z.string().uuid(),
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.moveMedia(input.mediaId, input.targetSourceId)
    ),

  /**
   * Upload media to a source
   */
  /**
   * Upload media to a source
   */
  upload: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        file: z.instanceof(File),
        filename: z.string().optional(),
        description: z.string().optional(),
        sourceUrl: z.string().optional(),
        overwrite: z.string().optional(),
        autoIncrement: z.string().optional(),
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.uploadMedia(input.sourceId, input.file, {
          filename: input.filename,
          description: input.description,
          sourceUrl: input.sourceUrl,
          overwrite: input.overwrite === "true",
          autoIncrement: input.autoIncrement === "true",
        })
    ),
};
