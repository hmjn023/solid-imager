/**
 * FileWatcherService - Manages file system monitoring for media sources
 */

import path from "node:path";
import {
  registerMediaWithJobs,
  updateMediaWithJobs,
} from "~/infrastructure/jobs/media-registration";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

const sourceRepo = new DrizzleSourceRepository();

/**
 * Handles file addition events from the file system watcher.
 * Registers the new media in the database and queues thumbnail generation.
 */
async function handleFileAdded(
  mediaSourceId: string,
  relativePath: string
): Promise<void> {
  try {
    const source = await sourceRepo.findById(mediaSourceId);
    if (!source || source.type !== "local") {
      return;
    }

    const basePath = (source.connectionInfo as { path: string }).path;
    const fullPath = path.join(basePath, relativePath);

    // Check if file is an image
    const ext = path.extname(relativePath).toLowerCase();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
    // Simple video/audio check could be added here similar to MediaService
    if (
      !(
        imageExtensions.includes(ext) ||
        [".mp4", ".webm", ".mov", ".mp3", ".wav"].includes(ext)
      )
    ) {
      return;
    }

    // Check if media already exists
    const existing = await MediaRepository.findByPath(
      mediaSourceId,
      relativePath
    );
    if (existing) {
      return;
    }

    // Extract metadata
    const fileMetadata = await LocalMediaStorage.getFileMetadata(fullPath);

    // Determine type
    let mediaType: "image" | "video" | "audio" = "image";
    if ([".mp4", ".webm", ".mov"].includes(ext)) {
      mediaType = "video";
    }
    if ([".mp3", ".wav"].includes(ext)) {
      mediaType = "audio";
    }

    // Register media with jobs using centralized function
    await registerMediaWithJobs({
      mediaSourceId,
      basePath,
      newMedia: {
        mediaSourceId,
        filePath: relativePath,
        fileName: path.basename(relativePath),
        mediaType,
        width: fileMetadata.width,
        height: fileMetadata.height,
        fileSize: fileMetadata.size,
        description: null,
        createdAt: fileMetadata.createdAt,
        modifiedAt: fileMetadata.modifiedAt,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, mediaSourceId, relativePath },
      "Failed to handle file added"
    );
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
    const media = await MediaRepository.findByPath(mediaSourceId, relativePath);

    if (!media) {
      return;
    }

    // Delete from database
    await MediaRepository.delete(media.id);

    // Delete thumbnail
    const { deleteThumbnail } = await import(
      "~/infrastructure/jobs/thumbnails"
    );
    await deleteThumbnail(mediaSourceId, media.id);

    // Notify
    SseManager.sendEvent(mediaSourceId, "media-deleted", {
      filePath: media.filePath,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { err: error, mediaSourceId, relativePath },
      "Failed to handle file deleted"
    );
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
    const source = await sourceRepo.findById(mediaSourceId);
    if (!source || source.type !== "local") {
      return;
    }

    const basePath = (source.connectionInfo as { path: string }).path;
    const fullPath = path.join(basePath, relativePath);

    // Find media by path
    const media = await MediaRepository.findByPath(mediaSourceId, relativePath);

    if (!media) {
      // Treat as new file
      await handleFileAdded(mediaSourceId, relativePath);
      return;
    }

    // Update metadata
    const fileMetadata = await LocalMediaStorage.getFileMetadata(fullPath);

    // Update media with jobs using centralized function
    await updateMediaWithJobs({
      mediaSourceId,
      mediaId: media.id,
      basePath,
      updates: {
        width: fileMetadata.width,
        height: fileMetadata.height,
        fileSize: fileMetadata.size,
        modifiedAt: fileMetadata.modifiedAt,
      },
    });
  } catch (error) {
    logger.error(
      { err: error, mediaSourceId, relativePath },
      "Failed to handle file changed"
    );
  }
}

/**
 * Starts file system monitoring for a media source.
 */
export async function startMonitoring(mediaSourceId: string): Promise<void> {
  try {
    const source = await sourceRepo.findById(mediaSourceId);
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
  } catch (error) {
    logger.error({ err: error, mediaSourceId }, "Failed to start monitoring");
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
  const sources = await sourceRepo.findAll();

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
