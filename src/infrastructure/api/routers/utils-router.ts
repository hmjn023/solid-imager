import { os } from "@orpc/server";
import { z } from "zod";
import { taggingService } from "~/application/services/tagging-service";
import { tagImageRequestSchema } from "~/domain/tagging/schemas";

/**
 * Utils Router Implementation
 * Handles utility-like functions: fetchUrl, AI tagging, etc.
 */
export const utilsRouter = {
  /**
   * Fetches content from an external URL (Proxy)
   */
  fetchUrl: os
    .input(z.object({ url: z.string().url() }))
    .handler(async ({ input }) => {
      const response = await fetch(input.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      return await response.blob();
    }),

  /**
   * Extract tags from an image using AI
   */
  aiTag: os
    .input(
      z.union([
        z.object({ file: z.instanceof(File) }),
        tagImageRequestSchema, // mediaSourceId + mediaId
      ])
    )
    .handler(async ({ input }) => {
      if ("file" in input) {
        const buffer = await input.file.arrayBuffer();
        return await taggingService.getTags(buffer);
      }

      if (!(input.mediaSourceId && input.mediaId)) {
        throw new Error("mediaSourceId and mediaId are required");
      }

      return await taggingService.getTagsForMedia(
        input.mediaSourceId,
        input.mediaId
      );
    }),
};
