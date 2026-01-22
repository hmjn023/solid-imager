import fs from "node:fs/promises";
import path from "node:path";
// import {
//   selectMediaById,
//   selectMediaBySourceId,
// } from "~/infrastructure/db/queries/media"; // Removed
import type { Media } from "~/infrastructure/db/schema";
import {
  addJobsToQueue,
  type Job,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { MediaRepository } from "~/infrastructure/repositories/media-repository"; // Added
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";

const sourceRepo = new DrizzleSourceRepository();

const DEFAULT_THUMBNAIL_SIZE = 512;
const DEFAULT_THUMBNAIL_QUALITY = 80;

export function getSourceCacheDir(mediaSourceId: string): string {
  return path.join(".cache/thumbnails", mediaSourceId);
}

/**
 * Ensures that the thumbnail cache directory for a specific source exists.
 * If the directory does not exist, it will be created recursively.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {Promise<void>} A promise that resolves when the directory is ensured.
 */
async function ensureCacheDir(mediaSourceId: string) {
  await fs.mkdir(getSourceCacheDir(mediaSourceId), { recursive: true });
}

/**
 * Generates the full path for a thumbnail file given a media ID and source ID.
 * The thumbnail files are stored in WebP format.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {string} mediaId - The ID of the media item.
 * @returns {string} The absolute path to the thumbnail file.
 */
export function getThumbnailPath(
  mediaSourceId: string,
  mediaId: string
): string {
  return path.join(getSourceCacheDir(mediaSourceId), `${mediaId}.webp`);
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
  mediaSourceId: string
): Promise<void> {
  await ensureCacheDir(mediaSourceId);

  const size = DEFAULT_THUMBNAIL_SIZE;
  const quality = DEFAULT_THUMBNAIL_QUALITY;

  const inputPath = path.join(sourcePath, media.filePath);
  const outputPath = getThumbnailPath(mediaSourceId, media.id);

  await ImageProcessor.generateThumbnail(inputPath, outputPath, size, quality);
}

/**
 * Deletes a thumbnail file from the cache.
 * Errors are ignored if the file does not exist (ENOENT).
 * @param {string} mediaId - The ID of the media item whose thumbnail is to be deleted.
 * @returns {Promise<void>} A promise that resolves when the thumbnail has been deleted or not found.
 */
export async function deleteThumbnail(
  mediaSourceId: string,
  mediaId: string
): Promise<void> {
  const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);
  try {
    await fs.unlink(thumbnailPath);
  } catch (error: unknown) {
    // ファイルが存在しない場合、このコンテキストではエラーではありません。
    if ((error as { code?: string }).code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Processes a single media job (thumbnail generation, metadata extraction).
 * @param {Job} job - The job to process.
 * @param {string} mediaSourceId - The ID of the media source.
 */
export async function processMediaJob(
  job: Job,
  mediaSourceId: string
): Promise<void> {
  const media = await MediaRepository.findById(job.mediaId);
  if (!media) {
    return;
  }

  if (job.type === "thumbnail") {
    await generateThumbnail(media, job.sourcePath, mediaSourceId);
    if (job.options?.skipMetadataExtraction) {
      // Notify clients that the thumbnail is ready (even if metadata extraction was skipped)
      SseManager.sendEvent(mediaSourceId, "thumbnail-generated", {
        mediaId: media.id,
      });
      return;
    }

    const mediaPath = path.join(job.sourcePath, media.filePath);
    try {
      const metadata = await ImageProcessor.extractMetadata(mediaPath);

      // Store generation info
      await MediaRepository.upsertGenerationInfo(
        media.id,
        typeof metadata.prompt === "object"
          ? JSON.stringify(metadata.prompt)
          : (metadata.prompt as string | null),
        metadata.workflow as object | null
      );

      // Store tags
      if (metadata.tags.length > 0) {
        await TagRepository.addTagsToMedia(
          media.id,
          metadata.tags,
          "comfyui_workflow"
        );
      }
    } catch (_e) {
      // Ignore metadata extraction errors during thumbnail generation
    }

    // Notify clients that the thumbnail is ready
    SseManager.sendEvent(mediaSourceId, "thumbnail-generated", {
      mediaId: media.id,
    });
  } else if (job.type === "extractTags") {
    const mediaPath = path.join(job.sourcePath, media.filePath);
    // Dynamic import to avoid circular dependency if any, or just standard import
    const { extractTags } = await import(
      "~/infrastructure/jobs/tag-extraction"
    );
    await extractTags(mediaPath, media.id);
  }
}

/**
 * Queues all media items from a specified source for thumbnail generation.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {Promise<number>} A promise that resolves with the number of jobs added to the queue.
 * @throws {Error} If the source is not found or is not a local source.
 */
export async function generateThumbnailsForSource(
  mediaSourceId: string
): Promise<number> {
  const mediaSource = await sourceRepo.findById(mediaSourceId);
  if (!mediaSource || mediaSource.type !== "local") {
    throw new Error("Source not found or not a local source");
  }

  const mediaItems = await MediaRepository.findAllBySourceId(mediaSourceId);
  if (mediaItems.length === 0) {
    return 0;
  }

  const jobs = mediaItems.map((media) => ({
    mediaId: media.id,
    sourcePath: (mediaSource.connectionInfo as { path: string }).path,
    type: "thumbnail" as const,
  }));

  addJobsToQueue(mediaSourceId, jobs);
  startJobQueue(mediaSourceId, (job) => processMediaJob(job, mediaSourceId));

  return jobs.length;
}
