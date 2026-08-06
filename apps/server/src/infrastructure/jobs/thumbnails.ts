import fs from "node:fs/promises";
import path from "node:path";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import {
	generateThumbnailJobPayloadSchema,
	type ThumbnailSize,
} from "@solid-imager/core/domain/thumbnails/schemas";
import { services } from "~/application/registry";
import type { Job, Media } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";

const sourceRepo = DrizzleSourceRepository;

const DEFAULT_THUMBNAIL_DIR = ".cache/thumbnails";
export const THUMBNAIL_SIZE_SMALL = 256 as const;
export const THUMBNAIL_SIZE_LARGE = 512 as const;
const DEFAULT_THUMBNAIL_SIZE = THUMBNAIL_SIZE_LARGE;
const DEFAULT_THUMBNAIL_QUALITY = 80;
const ENQUEUE_CONCURRENCY = 25;
const FILE_CHECK_CONCURRENCY = 50;

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
	sourcePath: string,
	mediaSourceId: string,
): Promise<void> {
	const inputPath = path.join(sourcePath, media.filePath);
	await generateThumbnailAtSize(
		inputPath,
		mediaSourceId,
		media.id,
		THUMBNAIL_SIZE_LARGE,
	);
	await generateThumbnailAtSize(
		getThumbnailPath(mediaSourceId, media.id, THUMBNAIL_SIZE_LARGE),
		mediaSourceId,
		media.id,
		THUMBNAIL_SIZE_SMALL,
	);
}

async function generateThumbnailAtSize(
	inputPath: string,
	mediaSourceId: string,
	mediaId: string,
	size: ThumbnailSize,
): Promise<void> {
	await ensureCacheDir(mediaSourceId, size);
	const storageConfig = getStorageConfig();
	const outputPath = getThumbnailPath(mediaSourceId, mediaId, size);
	if (
		size === THUMBNAIL_SIZE_SMALL &&
		storageConfig.thumbnailSize <= THUMBNAIL_SIZE_SMALL
	) {
		await fs.copyFile(inputPath, outputPath);
		return;
	}
	await ImageProcessor.generateThumbnail(
		inputPath,
		outputPath,
		size === THUMBNAIL_SIZE_LARGE
			? storageConfig.thumbnailSize
			: THUMBNAIL_SIZE_SMALL,
		storageConfig.thumbnailQuality,
	);
}

export async function generateThumbnailForMedia(
	mediaSourceId: string,
	mediaId: string,
	size: ThumbnailSize,
): Promise<void> {
	const [source, media] = await Promise.all([
		sourceRepo.findById(mediaSourceId),
		MediaRepository.findById(mediaId),
	]);
	if (
		source?.type !== "local" ||
		!media ||
		media.mediaSourceId !== mediaSourceId
	) {
		throw new Error("Media or local source not found");
	}
	const sourcePath = (source.connectionInfo as { path?: string }).path;
	if (!sourcePath) {
		throw new Error("Local source path is missing");
	}

	const originalPath = path.join(sourcePath, media.filePath);
	if (size === THUMBNAIL_SIZE_SMALL) {
		const largePath = getThumbnailPath(
			mediaSourceId,
			mediaId,
			THUMBNAIL_SIZE_LARGE,
		);
		if (
			!(await thumbnailExists(mediaSourceId, mediaId, THUMBNAIL_SIZE_LARGE))
		) {
			await generateThumbnailAtSize(
				originalPath,
				mediaSourceId,
				mediaId,
				THUMBNAIL_SIZE_LARGE,
			);
		}
		await generateThumbnailAtSize(
			largePath,
			mediaSourceId,
			mediaId,
			THUMBNAIL_SIZE_SMALL,
		);
		return;
	}

	await generateThumbnailAtSize(
		originalPath,
		mediaSourceId,
		mediaId,
		THUMBNAIL_SIZE_LARGE,
	);
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
	options: { size: ThumbnailSize; missingOnly: boolean },
): Promise<{ count: number; jobId?: string }> {
	const mediaSource = await sourceRepo.findById(mediaSourceId);
	if (mediaSource?.type !== "local") {
		throw new Error("Source not found or not a local source");
	}

	const mediaItems = await MediaRepository.findAllBySourceId(mediaSourceId);
	if (mediaItems.length === 0) {
		return { count: 0 };
	}

	const targets = options.missingOnly
		? await filterMissingThumbnails(mediaSourceId, mediaItems, options.size)
		: mediaItems;
	if (targets.length === 0) {
		return { count: 0 };
	}

	const jobRepo = services.getJobRepository();
	const parent = await jobRepo.create({
		type: "thumbnail_generation_parent",
		mediaSourceId,
		status: "in_progress",
		payload: {
			total: targets.length,
			processed: 0,
			failed: 0,
			mediaSourceId,
		},
	});

	let count = 0;
	try {
		for (let index = 0; index < targets.length; index += ENQUEUE_CONCURRENCY) {
			const chunk = targets.slice(index, index + ENQUEUE_CONCURRENCY);
			const created = await Promise.all(
				chunk.map((media) =>
					jobRepo.createIfUnique({
						type: "generate_thumbnail",
						mediaSourceId,
						parentId: parent.id,
						payload: { mediaId: media.id, size: options.size },
					}),
				),
			);
			count += created.filter(Boolean).length;
		}

		const currentParent = await jobRepo.findById(parent.id);
		const currentProgress = parseThumbnailParentPayload(currentParent?.payload);
		await jobRepo.update(parent.id, {
			payload: {
				total: count,
				processed: currentProgress.processed,
				failed: currentProgress.failed,
				mediaSourceId,
			},
		});
		if (count === 0) {
			await jobRepo.update(parent.id, { status: "completed" });
			return { count: 0 };
		}
		if (currentProgress.processed + currentProgress.failed >= count) {
			await finalizeThumbnailParent(parent.id, {
				...currentProgress,
				total: count,
			});
		}
		return { count, jobId: parent.id };
	} catch (error) {
		await jobRepo.update(parent.id, { status: "failed" });
		throw error;
	}
}

async function filterMissingThumbnails(
	mediaSourceId: string,
	mediaItems: Media[],
	size: ThumbnailSize,
): Promise<Media[]> {
	const missing: Media[] = [];
	for (
		let index = 0;
		index < mediaItems.length;
		index += FILE_CHECK_CONCURRENCY
	) {
		const chunk = mediaItems.slice(index, index + FILE_CHECK_CONCURRENCY);
		const results = await Promise.all(
			chunk.map(async (media) => ({
				media,
				exists: await thumbnailExists(mediaSourceId, media.id, size),
			})),
		);
		missing.push(
			...results.filter((result) => !result.exists).map(({ media }) => media),
		);
	}
	return missing;
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
		.getJobRepository()
		.createIfUnique({
			type: "generate_thumbnail",
			mediaSourceId,
			payload: { mediaId, size },
		})
		.then(() => undefined)
		.finally(() => thumbnailQueueInFlight.delete(key));
	thumbnailQueueInFlight.set(key, queued);
	await queued;
}

export async function processThumbnailGenerationJob(job: Job): Promise<void> {
	const payload = generateThumbnailJobPayloadSchema.parse(job.payload);
	if (!job.mediaSourceId) {
		throw new Error("Thumbnail generation job is missing mediaSourceId");
	}

	try {
		await generateThumbnailForMedia(
			job.mediaSourceId,
			payload.mediaId,
			payload.size,
		);
		RealtimeEventBus.publishSource(job.mediaSourceId, "thumbnail-generated", {
			mediaId: payload.mediaId,
			size: payload.size,
			timestamp: new Date().toISOString(),
		});
		await updateThumbnailParentProgress(job, true);
	} catch (error) {
		await updateThumbnailParentProgress(job, false);
		throw error;
	}
}

async function updateThumbnailParentProgress(
	job: Job,
	succeeded: boolean,
): Promise<void> {
	if (!job.parentId) {
		return;
	}
	const jobRepo = services.getJobRepository();
	const progress = succeeded
		? await jobRepo.incrementProgress(job.parentId, job.id)
		: await jobRepo.incrementFailedCount(job.parentId, job.id);
	if (!progress) {
		return;
	}
	RealtimeEventBus.publishJob("job-progress", {
		jobId: job.parentId,
		processed: progress.processed,
		total: progress.total,
	});
	if (progress.processed + progress.failed < progress.total) {
		return;
	}
	await finalizeThumbnailParent(job.parentId, progress);
}

async function finalizeThumbnailParent(
	parentId: string,
	progress: { processed: number; failed: number; total: number },
): Promise<void> {
	const jobRepo = services.getJobRepository();
	if (progress.failed > 0) {
		await jobRepo.update(parentId, { status: "failed" });
		RealtimeEventBus.publishJob("job-failed", {
			jobId: parentId,
			error: `${progress.failed} thumbnail job(s) failed`,
		});
		return;
	}
	await jobRepo.update(parentId, { status: "completed" });
	RealtimeEventBus.publishJob("job-completed", {
		jobId: parentId,
		message: "Thumbnail generation completed",
	});
}

function parseThumbnailParentPayload(payload: unknown) {
	return batchParentPayloadSchema.parse(payload);
}
