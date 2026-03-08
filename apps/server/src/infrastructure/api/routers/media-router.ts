import { ORPCError, os } from "@orpc/server";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import {
  mediaSearchRequestSchema,
  updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";

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
        sourceId: z.string().uuid().nullish(), // Optional for global search
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
        throw new ResourceNotFoundError("Media", input.mediaId);
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
    .handler(() => {
      // JSONシリアライズを避けるため、バッファコンテンツではなくURLまたはストリームを返す必要があります
      // 現時点では、誤用を防ぐためにバッファの返却を削除するか、エラーをスローするのが安全です。
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Binary content cannot be returned via oRPC. Please use the dedicated REST endpoint. Refer to the API documentation for details.",
      });
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
    .handler(
      async ({ input }) =>
        await MediaService.updateMedia(
          input.sourceId,
          input.mediaId,
          input.data
        )
    ),

  /**
   * Sync (reprocess) multiple media items
   */
  sync: os
    .meta({
      openapi: {
        tags: ["Media"],
        summary: "Sync (reprocess) media metadata",
        description: "Re-extract metadata and tags for specified media items",
      },
    })
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaIds: z.array(z.string().uuid()),
      })
    )
    .handler(async ({ input }) => {
      const results: { id: string; success: boolean; error?: string }[] = [];
      for (const mediaId of input.mediaIds) {
        try {
          await MediaService.reprocessMetadata(input.sourceId, mediaId);
          results.push({ id: mediaId, success: true });
        } catch (error) {
          results.push({ id: mediaId, success: false, error: String(error) });
        }
      }
      return { results };
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
      await MediaService.deleteMedia(input.sourceId, input.mediaId);
      return { success: true };
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
