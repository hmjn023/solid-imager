import { batchRunService } from "~/infrastructure/services/batch-run-service";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { MediaProcessingClaim } from "@solid-imager/core/domain/processing/schemas";
import type { PreparedThumbnail } from "@solid-imager/application/services/media-processing-service";
import { type ThumbnailSize } from "@solid-imager/core/domain/thumbnails/schemas";
import type { Media } from "~/infrastructure/db/schema";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { services } from "~/infrastructure/service-registry";

const sourceRepo = DrizzleSourceRepository;

const DEFAULT_THUMBNAIL_DIR = ".cache/thumbnails";
export const THUMBNAIL_SIZE_SMALL = 256 as const;
export const THUMBNAIL_SIZE_LARGE = 512 as const;
const DEFAULT_THUMBNAIL_SIZE = THUMBNAIL_SIZE_LARGE;
const DEFAULT_THUMBNAIL_QUALITY = 80;

type ThumbnailQueueGlobal = typeof globalThis & {
	__THUMBNAIL_QUEUE_IN_FLIGHT__?: Map<string, Promise<void>>;
};
const thumbnailQueueGlobal = globalThis as ThumbnailQueueGlobal;
const thumbnailQueueInFlight =
	thumbnailQueueGlobal.__THUMBNAIL_QUEUE_IN_FLIGHT__ ??
	new Map<string, Promise<void>>();
thumbnailQueueGlobal.__THUMBNAIL_QUEUE_IN_FLIGHT__ = thumbnailQueueInFlight;

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
async function ensureCacheDir(mediaSourceId: string, size: ThumbnailSize) {
	await fs.mkdir(getThumbnailCacheDir(mediaSourceId, size), {
		recursive: true,
	});
}

export function getThumbnailCacheDir(
	mediaSourceId: string,
	size: ThumbnailSize,
): string {
	const sourceCacheDir = getSourceCacheDir(mediaSourceId);
	return size === THUMBNAIL_SIZE_LARGE
		? sourceCacheDir
		: path.join(sourceCacheDir, String(size));
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
	size: ThumbnailSize = THUMBNAIL_SIZE_LARGE,
): string {
	return path.join(
		getThumbnailCacheDir(mediaSourceId, size),
		`${mediaId}.webp`,
	);
}

export async function thumbnailExists(
	mediaSourceId: string,
	mediaId: string,
	size: ThumbnailSize,
): Promise<boolean> {
	try {
		await fs.access(getThumbnailPath(mediaSourceId, mediaId, size));
		return true;
	} catch (error) {
		if ((error as { code?: string }).code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

/**
 * Generates a thumbnail for the specified media item.
 * The thumbnail is resized, converted to WebP format, and saved to the cache directory.
 * @param {Media} media - The media object from the database.
 * @param {string} sourcePath - The absolute path to the media source directory.
 * @returns {Promise<void>} A promise that resolves when the thumbnail has been generated.
 */
export async function generateThumbnail(
	media: Pick<Media, "id" | "filePath">,
	_sourcePath: string,
	mediaSourceId: string,
): Promise<void> {
	await services
		.getMediaProcessingService()
		.processTask(mediaSourceId, media.id, "thumbnail");
}

/** Convert outside a DB transaction; publish only while the dedicated claim is fenced. */
export async function prepareProcessingThumbnail(
	media: Pick<Media, "id" | "filePath">,
	sourcePath: string,
	mediaSourceId: string,
	claim?: MediaProcessingClaim,
): Promise<PreparedThumbnail> {
	const token = claim ? `${claim.revision}.${claim.token}` : randomUUID();
	const large = getThumbnailPath(mediaSourceId, media.id, THUMBNAIL_SIZE_LARGE);
	const small = getThumbnailPath(mediaSourceId, media.id, THUMBNAIL_SIZE_SMALL);
	const temporaryLarge = `${large}.${token}.tmp.webp`;
	const temporarySmall = `${small}.${token}.tmp.webp`;
	const cleanup = async () => {
		await Promise.all([
			fs.rm(temporaryLarge, { force: true }),
			fs.rm(temporarySmall, { force: true }),
		]);
	};
	try {
		await ensureCacheDir(mediaSourceId, THUMBNAIL_SIZE_LARGE);
		await ensureCacheDir(mediaSourceId, THUMBNAIL_SIZE_SMALL);
		const config = getStorageConfig();
		await ImageProcessor.generateThumbnail(
			path.join(sourcePath, media.filePath),
			temporaryLarge,
			config.thumbnailSize,
			config.thumbnailQuality,
		);
		if (config.thumbnailSize <= THUMBNAIL_SIZE_SMALL) {
			await fs.copyFile(temporaryLarge, temporarySmall);
		} else {
			await ImageProcessor.generateThumbnail(
				temporaryLarge,
				temporarySmall,
				THUMBNAIL_SIZE_SMALL,
				config.thumbnailQuality,
			);
		}
		return {
			commit: async () => {
				await fs.rename(temporaryLarge, large);
				await fs.rename(temporarySmall, small);
			},
			cleanup,
		};
	} catch (error) {
		await cleanup();
		throw error;
	}
}

export async function generateThumbnailForMedia(
	mediaSourceId: string,
	mediaId: string,
	_size: ThumbnailSize,
	force = false,
): Promise<void> {
	await services
		.getMediaProcessingService()
		.processTask(mediaSourceId, mediaId, "thumbnail", force);
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
	for (const size of [THUMBNAIL_SIZE_LARGE, THUMBNAIL_SIZE_SMALL] as const) {
		try {
			await fs.unlink(getThumbnailPath(mediaSourceId, mediaId, size));
		} catch (error: unknown) {
			if ((error as { code?: string }).code !== "ENOENT") {
				throw error;
			}
		}
	}
}

/**
 * Queues all media items from a specified source for processing.
 * Reserves dedicated requests; legacy child records observe batch progress until run/items migration.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {Promise<number>} A promise that resolves with the number of jobs added to the queue.
 * @throws {Error} If the source is not found or is not a local source.
 */
export async function generateThumbnailsForSource(
	mediaSourceId: string,
	options: { size: ThumbnailSize; missingOnly: boolean },
): Promise<{ count: number; jobId?: string }> {
	const source = await sourceRepo.findById(mediaSourceId);
	if (source?.type !== "local")
		throw new Error("Source not found or not a local source");
	const summary = await batchRunService.start({
		kind: "thumbnail",
		mediaSourceId,
		force: !options.missingOnly,
		missingOnly: options.missingOnly,
		thumbnailSize: options.size,
	});
	return {
		count: summary.progress.total,
		...(summary.progress.total ? { jobId: summary.run.id } : {}),
	};
}

export async function queueThumbnailGeneration(
	mediaSourceId: string,
	mediaId: string,
	size: ThumbnailSize,
): Promise<void> {
	const key = `${mediaSourceId}:${mediaId}:${size}`;
	const existing = thumbnailQueueInFlight.get(key);
	if (existing) {
		await existing;
		return;
	}
	const queued = services
		.getMediaProcessingService()
		.requestTask(mediaSourceId, mediaId, "thumbnail", false, undefined, true)
		.then(() => undefined)
		.finally(() => thumbnailQueueInFlight.delete(key));
	thumbnailQueueInFlight.set(key, queued);
	await queued;
}
