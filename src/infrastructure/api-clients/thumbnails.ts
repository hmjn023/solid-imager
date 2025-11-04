import fs from "node:fs/promises";
import {
  generateThumbnailsForSource,
  getSourceCacheDir,
} from "~/infrastructure/jobs/thumbnails";

/**
 * Initiates the thumbnail generation process for a specific media source.
 * This process runs in the background using a job queue.
 * @param {string} mediaSourceId - The ID of the media source.
 */
export function registerExistingMedia(mediaSourceId: string) {
  // Intentionally not awaiting the promise to run in the background.
  (async () => {
    // TODO: Add proper error handling/logging for background thumbnail generation
    await generateThumbnailsForSource(mediaSourceId);
  })();
}

/**
 * Manually starts thumbnail generation for a specific media source.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {Promise<{ success: boolean; message?: string }>} A promise that resolves with the result of the operation.
 */
export async function startThumbnailGeneration(mediaSourceId: string) {
  try {
    const jobsAdded = await generateThumbnailsForSource(mediaSourceId);
    return { success: true, message: `${jobsAdded} thumbnail jobs added.` };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to start thumbnail generation: ${errorMessage}`,
    };
  }
}

/**
 * Clears the thumbnail cache for a specific source.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {object} An object indicating the success of the operation.
 */
export async function clearThumbnailCache(mediaSourceId: string) {
  const cacheDir = getSourceCacheDir(mediaSourceId);
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    await fs.mkdir(cacheDir, { recursive: true });
    return { success: true, message: "Thumbnail cache cleared" };
  } catch (_error) {
    return { success: false, message: "Failed to clear thumbnail cache" };
  }
}
