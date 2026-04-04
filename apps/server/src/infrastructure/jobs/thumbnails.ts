import fs from "node:fs/promises";
import path from "node:path";
import { services } from "~/application/registry";
// import {
//   selectMediaById,
//   selectMediaBySourceId,
// } from "~/infrastructure/db/queries/media"; // Removed
import type { Media } from "~/infrastructure/db/schema";
import { MediaRepository } from "~/infrastructure/repositories/media-repository"; // Added
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

const sourceRepo = new DrizzleSourceRepository();

const DEFAULT_THUMBNAIL_DIR = ".cache/thumbnails";
const DEFAULT_THUMBNAIL_SIZE = 512;
const DEFAULT_THUMBNAIL_QUALITY = 80;

/**
 * Gets storage config with safe fallback for tests or when ConfigService is not registered
 */
function getStorageConfig() {
	try {
		return services.getConfigService().getConfig().storage;
	} catch {
		// Fallback for tests or when ConfigService is not registered
		return {
			thumbnailDir: DEFAULT_THUMBNAIL_DIR,
			thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
			thumbnailQuality: DEFAULT_THUMBNAIL_QUALITY,
		};
	}
}

export function getSourceCacheDir(mediaSourceId: string): string {
	const storageConfig = getStorageConfig();
	return path.join(storageConfig.thumbnailDir, mediaSourceId);
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
	mediaId: string,
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
	mediaSourceId: string,
): Promise<void> {
	await ensureCacheDir(mediaSourceId);

	const storageConfig = getStorageConfig();
	const size = storageConfig.thumbnailSize;
	const quality = storageConfig.thumbnailQuality;

	const inputPath = path.join(sourcePath, media.filePath);
	const outputPath = getThumbnailPath(mediaSourceId, media.id);

	await services
		.getThumbnailGenerator()
		.generate(inputPath, outputPath, size, quality);
}

/**
 * Deletes a thumbnail file from the cache.
 * Errors are ignored if the file does not exist (ENOENT).
 * @param {string} mediaId - The ID of the media item whose thumbnail is to be deleted.
 * @returns {Promise<void>} A promise that resolves when the thumbnail has been deleted or not found.
 */
export async function deleteThumbnail(
	mediaSourceId: string,
	mediaId: string,
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
 * @deprecated Use MediaProcessingService.executeProcessMediaJob instead.
 * Processes a single media job (thumbnail generation, metadata extraction).
 * This function is kept for backwards compatibility but will be removed.
 * @param {Job} job - The job to process.
 * @param {string} mediaSourceId - The ID of the media source.
 */
export function processMediaJob(
	_job: unknown, // or Job from schema
	_mediaSourceId: string,
): Promise<void> {
	// This function is deprecated and should probably be removed or updated to use DB Job context if called directly.
	// For now, since it was used by job-manager callback, and we removed it, we can arguably remove this function.
	// But if it's imported elsewhere, we keep signature.
	return Promise.resolve();
}

/**
 * Queues all media items from a specified source for processing.
 * Uses the unified processMedia job type.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {Promise<number>} A promise that resolves with the number of jobs added to the queue.
 * @throws {Error} If the source is not found or is not a local source.
 */
export async function generateThumbnailsForSource(
	mediaSourceId: string,
): Promise<number> {
	const mediaSource = await sourceRepo.findById(mediaSourceId);
	if (!mediaSource || mediaSource.type !== "local") {
		throw new Error("Source not found or not a local source");
	}

	const mediaItems = await MediaRepository.findAllBySourceId(mediaSourceId);
	if (mediaItems.length === 0) {
		return 0;
	}

	// Use processMedia job type for unified processing
	const jobRepo = services.getJobRepository();
	const basePath = (mediaSource.connectionInfo as { path: string }).path;

	for (const media of mediaItems) {
		await jobRepo.create({
			type: "processMedia",
			mediaSourceId,
			payload: {
				mediaId: media.id,
				sourcePath: basePath,
				type: "processMedia",
			},
		});
	}

	// Jobs start automatically via worker
	return mediaItems.length;
}
