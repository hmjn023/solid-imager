/**
 * FileWatcherService - Manages file system monitoring for media sources
 *
 * Refactored to use MediaProcessingService as the unified entry point.
 */

import path from "node:path";
import { services } from "~/application/registry";
import { DirectorySyncService } from "~/application/services/directory-sync-service";
import { MediaProcessingService } from "~/application/services/media-processing-service";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

const sourceRepo = DrizzleSourceRepository;

// Supported file extensions for media detection
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
const AUDIO_EXTENSIONS = [".mp3", ".wav"];
const ALL_MEDIA_EXTENSIONS = [
	...IMAGE_EXTENSIONS,
	...VIDEO_EXTENSIONS,
	...AUDIO_EXTENSIONS,
];

/**
 * Handles file addition events from the file system watcher.
 * Uses MediaProcessingService for unified registration and job queuing.
 */
async function handleFileAdded(
	mediaSourceId: string,
	relativePath: string,
): Promise<void> {
	try {
		// Check if file is a supported media type
		const ext = path.extname(relativePath).toLowerCase();
		if (!ALL_MEDIA_EXTENSIONS.includes(ext)) {
			return;
		}

		// Check if media already exists (to avoid duplicates from rapid events)
		const existing = await MediaRepository.findByPath(
			mediaSourceId,
			relativePath,
		);
		if (existing) {
			return;
		}

		// Use MediaProcessingService for unified registration and processing
		await MediaProcessingService.registerAndProcess(
			mediaSourceId,
			relativePath,
			// No context metadata for file watcher - metadata is extracted by the job
		);
	} catch (error) {
		logger.error(
			{ err: error, mediaSourceId, relativePath },
			"Failed to handle file added",
		);
	}
}

/**
 * Handles file deletion events from the file system watcher.
 * Removes the media from the database and deletes the thumbnail.
 */
async function handleFileDeleted(
	mediaSourceId: string,
	relativePath: string,
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
		await deleteThumbnail(mediaSourceId, media.id);

		// Notify
		SseManager.sendEvent(mediaSourceId, "media-deleted", {
			filePath: media.filePath,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error(
			{ err: error, mediaSourceId, relativePath },
			"Failed to handle file deleted",
		);
	}
}

/**
 * Handles file change events from the file system watcher.
 * Updates the media metadata and queues reprocessing.
 */
async function handleFileChanged(
	mediaSourceId: string,
	relativePath: string,
): Promise<void> {
	try {
		const source = await sourceRepo.findById(mediaSourceId);
		if (source?.type !== "local") {
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

		// Update file metadata (size, dimensions, mtime)
		const fileMetadata = await ServerMediaStorage.getFileMetadata(fullPath);
		await MediaRepository.update(media.id, {
			width: fileMetadata.width,
			height: fileMetadata.height,
			fileSize: fileMetadata.size,
			modifiedAt: fileMetadata.modifiedAt,
		});

		// Queue processMedia job for thumbnail regeneration and metadata re-extraction
		const jobRepo = services.getJobRepository();
		await jobRepo.create({
			type: "processMedia",
			mediaSourceId,
			payload: {
				mediaId: media.id,
				sourcePath: basePath,
				type: "processMedia",
			},
		});

		// Notify
		SseManager.sendEvent(mediaSourceId, "media-changed", {
			mediaId: media.id,
			filePath: media.filePath,
		});
	} catch (error) {
		logger.error(
			{ err: error, mediaSourceId, relativePath },
			"Failed to handle file changed",
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

		// Run directory sync before starting real-time file system monitoring
		try {
			await DirectorySyncService.syncMediaSource(mediaSourceId);
		} catch (err) {
			logger.error(
				{ err, mediaSourceId },
				"Failed to sync media source before monitoring",
			);
		}

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
