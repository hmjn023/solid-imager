import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getConfig } from "~/infrastructure/api-clients/config";
import { selectMediaBySourceId } from "~/infrastructure/db/queries/media";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";
import type { Media } from "~/infrastructure/db/schema";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/thumbnail-jobs";

const CACHE_DIR = ".cache/thumbnails";

const DEFAULT_THUMBNAIL_SIZE = 512;
const DEFAULT_THUMBNAIL_QUALITY = 80;

/**
 * Ensures that the thumbnail cache directory exists.
 * If the directory does not exist, it will be created recursively.
 * @returns {Promise<void>} A promise that resolves when the directory is ensured.
 */
async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

/**
 * Generates the full path for a thumbnail file given a media ID.
 * The thumbnail files are stored in WebP format.
 * @param {string} mediaId - The ID of the media item.
 * @returns {string} The absolute path to the thumbnail file.
 */
export function getThumbnailPath(mediaId: string): string {
  return path.join(CACHE_DIR, `${mediaId}.webp`);
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
  sourcePath: string
): Promise<void> {
  await ensureCacheDir();

  const config = getConfig();
  const size =
    config.media?.image?.thumbnail?.size?.width ?? DEFAULT_THUMBNAIL_SIZE;
  const quality =
    config.media?.image?.thumbnail?.quality ?? DEFAULT_THUMBNAIL_QUALITY;

  const inputPath = path.join(sourcePath, media.filePath);
  const outputPath = getThumbnailPath(media.id);
  await sharp(inputPath)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toFile(outputPath);
}

/**
 * Deletes a thumbnail file from the cache.
 * Errors are ignored if the file does not exist (ENOENT).
 * @param {string} mediaId - The ID of the media item whose thumbnail is to be deleted.
 * @returns {Promise<void>} A promise that resolves when the thumbnail has been deleted or not found.
 */
export async function deleteThumbnail(mediaId: string): Promise<void> {
  const thumbnailPath = getThumbnailPath(mediaId);
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
  const sources = await selectMediaSourceById(sourceId);
  if (sources.length === 0 || sources[0].type !== "local") {
    throw new Error("Source not found or not a local source");
  }
  const source = sources[0];

  const mediaItems = await selectMediaBySourceId(sourceId);
  if (mediaItems.length === 0) {
    return 0;
  }

  const jobs = mediaItems.map((media) => ({
    mediaId: media.id,
    sourcePath: source.connectionInfo.path,
  }));

  addJobsToQueue(sourceId, jobs);
  startJobQueue(sourceId, async (job) => {
    const media = mediaItems.find((m) => m.id === job.mediaId);
    if (media) {
      await generateThumbnail(media, job.sourcePath);
    }
  });

  return jobs.length;
}
