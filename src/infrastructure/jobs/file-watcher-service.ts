/**
 * FileWatcherService - Manages file system monitoring for media sources
 */

import path from "node:path";
import { ImageProcessor } from "~/domain/media/processing/image-processor";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { processMediaJob } from "~/infrastructure/jobs/thumbnails";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

/**
 * Handles file addition events from the file system watcher.
 * Registers the new media in the database and queues thumbnail generation.
 */
async function handleFileAdded(
  mediaSourceId: string,
  relativePath: string
): Promise<void> {
  try {
    const source = await selectMediaSourceById(mediaSourceId);
    if (!source || source.type !== "local") {
      return;
    }

    const basePath = (source.connectionInfo as { path: string }).path;
    const fullPath = path.join(basePath, relativePath);

    // Check if file is an image
    const ext = path.extname(relativePath).toLowerCase();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
    if (!imageExtensions.includes(ext)) {
      return;
    }

    // Check if media already exists
    const existing = await MediaRepository.findBySourceAndPath(
      mediaSourceId,
      relativePath
    );
    if (existing.length > 0) {
      return;
    }

    // Extract metadata
    const metadata = await MediaRepository.getFileMetadata(fullPath);

    // Create media entry
    const media = await MediaRepository.create({
      mediaSourceId,
      filePath: relativePath,
      fileName: path.basename(relativePath),
      mediaType: "image",
      width: metadata.width,
      height: metadata.height,
      fileSize: metadata.size,
      description: null,
      sourceUrl: null,
      createdAt: metadata.createdAt,
      modifiedAt: metadata.modifiedAt,
      indexedAt: new Date(),
      status: "active",
    });

    // Queue thumbnail generation
    addJobsToQueue(mediaSourceId, [
      {
        mediaId: media.id,
        sourcePath: basePath,
        type: "thumbnail" as const,
      },
    ]);
    startJobQueue(mediaSourceId, (job) => processMediaJob(job, mediaSourceId));

    // Extract metadata in the background
    await ImageProcessor.extractMetadata(fullPath, media.id);
  } catch (_error) {
    // Error already logged in console by handleFileAdded
  }
}

/**
 * Handles file deletion events from the file system watcher.
 * Removes the media from the database and deletes the thumbnail.
 */
async function handleFileDeleted(
  mediaSourceId: string,
  relativePath: string
): Promise<void> {
  try {
    // Find media by path
    const mediaItems = await MediaRepository.findBySourceAndPath(
      mediaSourceId,
      relativePath
    );

    if (mediaItems.length === 0) {
      return;
    }

    for (const media of mediaItems) {
      // Delete from database
      await MediaRepository.delete(media.id);

      // Delete thumbnail
      const { deleteThumbnail } = await import(
        "~/infrastructure/jobs/thumbnails"
      );
      await deleteThumbnail(mediaSourceId, media.id);
    }
  } catch (_error) {
    // Error already logged in console by handleFileDeleted
  }
}

/**
 * Handles file change events from the file system watcher.
 * Updates the media metadata and regenerates the thumbnail.
 */
async function handleFileChanged(
  mediaSourceId: string,
  relativePath: string
): Promise<void> {
  try {
    const source = await selectMediaSourceById(mediaSourceId);
    if (!source || source.type !== "local") {
      return;
    }

    const basePath = (source.connectionInfo as { path: string }).path;
    const fullPath = path.join(basePath, relativePath);

    // Find media by path
    const mediaItems = await MediaRepository.findBySourceAndPath(
      mediaSourceId,
      relativePath
    );

    if (mediaItems.length === 0) {
      // Treat as new file
      await handleFileAdded(mediaSourceId, relativePath);
      return;
    }

    for (const media of mediaItems) {
      // Update metadata
      const metadata = await MediaRepository.getFileMetadata(fullPath);
      await MediaRepository.update(media.id, {
        width: metadata.width,
        height: metadata.height,
        fileSize: metadata.size,
        modifiedAt: metadata.modifiedAt,
      });

      // Regenerate thumbnail
      addJobsToQueue(mediaSourceId, [
        {
          mediaId: media.id,
          sourcePath: basePath,
          type: "thumbnail" as const,
        },
      ]);
      startJobQueue(mediaSourceId, (job) =>
        processMediaJob(job, mediaSourceId)
      );

      // Re-extract metadata
      await ImageProcessor.extractMetadata(fullPath, media.id);
    }
  } catch (_error) {
    // Error already logged in console by handleFileChanged
  }
}

/**
 * Starts file system monitoring for a media source.
 */
export async function startMonitoring(mediaSourceId: string): Promise<void> {
  try {
    const source = await selectMediaSourceById(mediaSourceId);
    if (!source) {
      return;
    }

    if (source.type !== "local") {
      return;
    }

    const basePath = (source.connectionInfo as { path: string }).path;

    SseManager.startFileSystemMonitoring(mediaSourceId, basePath, {
      onAdd: (filePath) => handleFileAdded(mediaSourceId, filePath),
      onDelete: (filePath) => handleFileDeleted(mediaSourceId, filePath),
      onChange: (filePath) => handleFileChanged(mediaSourceId, filePath),
    });
  } catch (_error) {
    // Error already logged in console by startMonitoring
  }
}

/**
 * Stops file system monitoring for a media source.
 */
export async function stopMonitoring(mediaSourceId: string): Promise<void> {
  await SseManager.stopFileSystemMonitoring(mediaSourceId);
}

/**
 * Starts monitoring for all local media sources.
 */
export async function startMonitoringAll(): Promise<void> {
  const { selectMediaSources } = await import(
    "~/infrastructure/db/queries/media-sources"
  );
  const sources = await selectMediaSources();

  for (const source of sources) {
    if (source.type === "local") {
      await startMonitoring(source.id);
    }
  }
}

export const FileWatcherService = {
  startMonitoring,
  stopMonitoring,
  startMonitoringAll,
};
