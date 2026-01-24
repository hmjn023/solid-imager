/**
 * MediaProcessingService - Unified entry point for media registration and processing
 *
 * This service consolidates the scattered media processing logic from:
 * - download-jobs.ts (downloads)
 * - file-watcher-service.ts (file system monitoring)
 * - media-service.ts (manual uploads)
 * - backup-service.ts (imports)
 */

import path from "node:path";
import type { Media, MediaMetadataContext } from "~/domain/media/schemas";
import type { Job } from "~/infrastructure/jobs/job-manager";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

// Configuration: Auto-tagging is disabled by default until config system is implemented
const ENABLE_AUTO_TAGGING = false;

const sourceRepo = new DrizzleSourceRepository();

/**
 * Unified entry point for media registration and processing.
 *
 * Synchronous operations (for immediate UX feedback):
 * - DB record creation
 * - Author, SourceURL, Tag, etc. registration (from contextMetadata)
 *
 * Asynchronous operations (queued as processMedia job):
 * - Metadata extraction (Width/Height, Exif, ComfyUI info)
 * - Thumbnail generation
 * - AI tagging (when enabled)
 *
 * @param mediaSourceId - The source ID
 * @param relativePath - Relative path from source root
 * @param contextMetadata - Optional initial metadata from external context
 * @returns The created Media record
 */
export async function registerAndProcess(
  mediaSourceId: string,
  relativePath: string,
  contextMetadata?: Partial<MediaMetadataContext>
): Promise<Media> {
  const source = await sourceRepo.findById(mediaSourceId);
  if (!source || source.type !== "local") {
    throw new Error(`Source not found or not a local source: ${mediaSourceId}`);
  }

  const basePath = (source.connectionInfo as { path: string }).path;
  const fullPath = path.join(basePath, relativePath);

  // Get file metadata
  const fileMetadata = await LocalMediaStorage.getFileMetadata(fullPath);

  // Determine media type from extension
  const ext = path.extname(relativePath).toLowerCase();
  let mediaType: "image" | "video" | "audio" = "image";
  if ([".mp4", ".webm", ".mov"].includes(ext)) {
    mediaType = "video";
  } else if ([".mp3", ".wav"].includes(ext)) {
    mediaType = "audio";
  }

  // Step 1: Create media record (synchronous)
  // Use createdAt from context if provided (e.g., original post date from xtracter),
  // falling back to file metadata
  const media = await MediaRepository.create({
    mediaSourceId,
    filePath: relativePath,
    fileName: path.basename(relativePath),
    mediaType,
    width: fileMetadata.width,
    height: fileMetadata.height,
    fileSize: fileMetadata.size,
    description: contextMetadata?.description ?? null,
    createdAt: contextMetadata?.createdAt ?? fileMetadata.createdAt,
    modifiedAt: fileMetadata.modifiedAt,
  });

  // Step 2: Register related data from context (synchronous)
  if (contextMetadata) {
    await registerContextMetadata(media.id, contextMetadata);
  }

  // Step 3: Queue processMedia job (asynchronous)
  addJobsToQueue(mediaSourceId, [
    {
      mediaId: media.id,
      sourcePath: basePath,
      type: "processMedia" as const,
    },
  ]);
  startJobQueue(mediaSourceId, (job) =>
    executeProcessMediaJob(job, mediaSourceId)
  );

  // Notify clients
  SseManager.sendEvent(mediaSourceId, "media-added", {
    mediaId: media.id,
    filePath: media.filePath,
  });

  return media;
}

/**
 * Registers context metadata (authors, URLs, tags, etc.) for a media item.
 * This is called synchronously during registerAndProcess for immediate UX feedback.
 */
async function registerContextMetadata(
  mediaId: string,
  context: Partial<MediaMetadataContext>
): Promise<void> {
  // Register source URLs
  if (context.sourceUrls && context.sourceUrls.length > 0) {
    await MediaRepository.addUrls(mediaId, context.sourceUrls);
  }

  // Register authors
  // AuthorRepository.create handles deduplication by accountId or name
  if (context.authors && context.authors.length > 0) {
    for (const author of context.authors) {
      try {
        const createdAuthor = await AuthorRepository.create({
          name: author.name,
          accountId: author.accountId ?? null,
        });
        await AuthorRepository.addMedia(mediaId, createdAuthor.id);
      } catch (e) {
        logger.warn({ err: e, author }, "Failed to register author");
      }
    }
  }

  // Register tags
  if (context.tags && context.tags.length > 0) {
    await TagRepository.addTagsToMedia(
      mediaId,
      context.tags.map((t) => ({ name: t.name, type: t.type ?? "positive" })),
      "user_provided"
    );
  }

  // TODO: Register characters, IPs, projects when needed
}

/**
 * Executes the processMedia job.
 * Each step is executed independently - individual failures do not stop the entire job.
 *
 * @param job - The job to process
 * @param mediaSourceId - The source ID
 */
export async function executeProcessMediaJob(
  job: Job,
  mediaSourceId: string
): Promise<void> {
  // Only handle processMedia jobs
  if (job.type !== "processMedia") {
    return;
  }

  const media = await MediaRepository.findById(job.mediaId);
  if (!media) {
    logger.warn(
      { mediaId: job.mediaId },
      "Media not found for processMedia job"
    );
    return;
  }

  const mediaPath = path.join(job.sourcePath, media.filePath);

  // Step 1: Metadata extraction (failure does not affect thumbnail generation)
  // Note: Width/height are already extracted by LocalMediaStorage.getFileMetadata
  // ImageProcessor.extractMetadata extracts ComfyUI workflow data and tags
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

    // Store tags from workflow
    if (metadata.tags.length > 0) {
      await TagRepository.addTagsToMedia(
        media.id,
        metadata.tags,
        "comfyui_workflow"
      );
    }
  } catch (e) {
    logger.warn(
      { err: e, mediaId: job.mediaId },
      "Metadata extraction failed, continuing..."
    );
  }

  // Step 2: Thumbnail generation (failure affects UI but media registration succeeds)
  try {
    await generateThumbnail(media, job.sourcePath, mediaSourceId);
    SseManager.sendEvent(mediaSourceId, "thumbnail-generated", {
      mediaId: media.id,
    });
  } catch (e) {
    logger.error(
      { err: e, mediaId: job.mediaId },
      "Thumbnail generation failed"
    );
  }

  // Step 3: AI tagging (optional, controlled by config)
  if (ENABLE_AUTO_TAGGING) {
    try {
      // Placeholder for AI tagging implementation
      // await extractAiTags(mediaPath, job.mediaId);
      logger.info({ mediaId: job.mediaId }, "AI tagging not yet implemented");
    } catch (e) {
      logger.warn(
        { err: e, mediaId: job.mediaId },
        "AI tagging failed, skipping"
      );
    }
  }
}

export const MediaProcessingService = {
  registerAndProcess,
  executeProcessMediaJob,
};
