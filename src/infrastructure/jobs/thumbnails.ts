import fs from "node:fs/promises";
import path from "node:path";
import { ImageProcessor } from "~/domain/media/processing/image-processor";
import { getConfig } from "~/infrastructure/api-clients/config";
import { selectMediaBySourceId } from "~/infrastructure/db/queries/media";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";
import type { Media } from "~/infrastructure/db/schema";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/thumbnail-jobs";

const DEFAULT_THUMBNAIL_SIZE = 512;
const DEFAULT_THUMBNAIL_QUALITY = 80;

export function getSourceCacheDir(sourceId: string): string {
  return path.join(".cache/thumbnails", sourceId);
}

/**
 * Ensures that the thumbnail cache directory for a specific source exists.
 * If the directory does not exist, it will be created recursively.
 * @param {string} sourceId - The ID of the media source.
 * @returns {Promise<void>} A promise that resolves when the directory is ensured.
 */
async function ensureCacheDir(sourceId: string) {
  await fs.mkdir(getSourceCacheDir(sourceId), { recursive: true });
}

/**
 * Generates the full path for a thumbnail file given a media ID and source ID.
 * The thumbnail files are stored in WebP format.
 * @param {string} sourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item.
 * @returns {string} The absolute path to the thumbnail file.
 */
export function getThumbnailPath(sourceId: string, mediaId: string): string {
  return path.join(getSourceCacheDir(sourceId), `${mediaId}.webp`);
}

/**
 * Generates a thumbnail for the specified media item.
 * The thumbnail is resized, converted to WebP format, and saved to the cache directory.
 * @param {Media} media - The media object from the database.
 * @param {string} sourcePath - The absolute path to the media source directory.
 * @returns {Promise<void>} A promise that resolves when the thumbnail has been generated.
 */
export async function generateThumbnail(
  media: Media,
  sourcePath: string,
  sourceId: string
): Promise<void> {
  await ensureCacheDir(sourceId);

  const config = getConfig();
  const size =
    config.media?.image?.thumbnail?.size?.width ?? DEFAULT_THUMBNAIL_SIZE;
  const quality =
    config.media?.image?.thumbnail?.quality ?? DEFAULT_THUMBNAIL_QUALITY;

  const inputPath = path.join(sourcePath, media.filePath);
  const outputPath = getThumbnailPath(sourceId, media.id);

  await ImageProcessor.generateThumbnail(inputPath, outputPath, size, quality);
}

/**
 * Deletes a thumbnail file from the cache.
 * Errors are ignored if the file does not exist (ENOENT).
 * @param {string} mediaId - The ID of the media item whose thumbnail is to be deleted.
 * @returns {Promise<void>} A promise that resolves when the thumbnail has been deleted or not found.
 */
export async function deleteThumbnail(
  sourceId: string,
  mediaId: string
): Promise<void> {
  const thumbnailPath = getThumbnailPath(sourceId, mediaId);
  try {
    await fs.unlink(thumbnailPath);
  } catch (error: unknown) {
    // ファイルが存在しない場合、このコンテキストではエラーではありません。
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Queues all media items from a specified source for thumbnail generation.
 * @param {string} sourceId - The ID of the media source.
 * @returns {Promise<number>} A promise that resolves with the number of jobs added to the queue.
 * @throws {Error} If the source is not found or is not a local source.
 */
export async function generateThumbnailsForSource(
  sourceId: string
): Promise<number> {
  const source = await selectMediaSourceById(sourceId);
  if (!source || source.type !== "local") {
    throw new Error("Source not found or not a local source");
  }

  const mediaItems = await selectMediaBySourceId(sourceId);
  if (mediaItems.length === 0) {
    return 0;
  }

  const jobs = mediaItems.map((media) => ({
    mediaId: media.id,
    sourcePath: source.connectionInfo?.path,
  }));

  addJobsToQueue(sourceId, jobs);
  startJobQueue(sourceId, async (job) => {
    const media = mediaItems.find((m) => m.id === job.mediaId);
    if (media) {
      await generateThumbnail(media, job.sourcePath, sourceId);
      const mediaPath = path.join(job.sourcePath, media.filePath);
      await ImageProcessor.extractMetadata(mediaPath, media.id);
    }
  });

  return jobs.length;
}
