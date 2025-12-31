import fs from "node:fs/promises";
import { os } from "@orpc/server";
import { z } from "zod";
import {
  generateThumbnailsForSource,
  getSourceCacheDir,
} from "~/infrastructure/jobs/thumbnails";

/**
 * Thumbnails Router Implementation
 */
export const thumbnailsRouter = {
  /**
   * Generates thumbnails for all media in a source
   */
  generate: os
    .input(z.object({ sourceId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const count = await generateThumbnailsForSource(input.sourceId);
      return { success: true, count };
    }),

  /**
   * Clears the thumbnail cache for a specific source
   */
  clear: os
    .input(z.object({ sourceId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const cacheDir = getSourceCacheDir(input.sourceId);
      try {
        await fs.rm(cacheDir, { recursive: true, force: true });
        return { success: true };
      } catch (error) {
        throw new Error(`Failed to clear thumbnail cache: ${error}`);
      }
    }),
};
