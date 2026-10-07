import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
	ProcessingOwner,
	MediaProcessingClaim,
} from "@solid-imager/core/domain/processing/schemas";
import type { PreparedThumbnail } from "@solid-imager/application/services/media-processing-service";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import {
	generateThumbnailJobPayloadSchema,
	type ThumbnailSize,
} from "@solid-imager/core/domain/thumbnails/schemas";
import type { Job, Media } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { services } from "~/infrastructure/service-registry";

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
	owner?: ProcessingOwner,
	force = false,
): Promise<void> {
	await services
		.getMediaProcessingService()
		.processTask(mediaSourceId, mediaId, "thumbnail", owner, force);
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
					DrizzleTransactionManager.transaction(async (tx) => {
						const request = await services
							.getMediaProcessingService()
							.requestTask(
								mediaSourceId,
								media.id,
								"thumbnail",
								!options.missingOnly,
								tx,
								true,
							);
						if (!request) return false;
						return jobRepo.createIfUnique(
							{
								type: "generate_thumbnail",
								mediaSourceId,
								parentId: parent.id,
								payload: {
									mediaId: media.id,
									size: options.size,
									processingRequest: {
										requestId: request.requestId,
										requestedRevision: request.requestedRevision,
									},
								},
							},
							tx,
						);
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
		.getMediaProcessingService()
		.requestTask(mediaSourceId, mediaId, "thumbnail", false, undefined, true)
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
		const owner = { jobId: job.id, attemptCount: job.attemptCount ?? 0 };

		let request = payload.processingRequest;
		if (payload.retryFileTasks) {
			const expected = request;
			request = await services
				.getJobRepository()
				.withActiveAttempt(owner.jobId, owner.attemptCount, async (tx) => {
					await MediaRepository.findById(payload.mediaId, tx, {
						forUpdate: true,
					});
					const state = (
						await MediaProcessingStateRepository.findByMediaIds(
							[payload.mediaId],
							tx,
						)
					).find((row) => row.taskKind === "thumbnail");
					let next = expected;
					if (
						!expected ||
						(state?.requestId === expected.requestId &&
							state.requestedRevision === expected.requestedRevision &&
							state.status === "failed")
					) {
						const reserved = await services
							.getMediaProcessingService()
							.requestTask(
								job.mediaSourceId ?? "",
								payload.mediaId,
								"thumbnail",
								state?.status === "failed",
								tx,
								true,
							);
						if (reserved)
							next = {
								requestId: reserved.requestId,
								requestedRevision: reserved.requestedRevision,
							};
					}
					await services.getJobRepository().update(
						job.id,
						{
							payload: {
								...payload,
								retryFileTasks: false,
								processingRequest: next,
							},
						},
						tx,
					);
					return next;
				});
		}
		if (request)
			await services
				.getMediaProcessingService()
				.waitForTask(payload.mediaId, "thumbnail", request, owner);
		else {
			// Bind old payloads once so stale recovery cannot replay a force request.
			request = await services
				.getJobRepository()
				.withActiveAttempt(owner.jobId, owner.attemptCount, async (tx) => {
					const reserved = await services
						.getMediaProcessingService()
						.requestTask(
							job.mediaSourceId ?? "",
							payload.mediaId,
							"thumbnail",
							payload.force,
							tx,
							true,
						);
					const identity = reserved
						? {
								requestId: reserved.requestId,
								requestedRevision: reserved.requestedRevision,
							}
						: undefined;
					await services.getJobRepository().update(
						job.id,
						{
							payload: {
								...payload,
								force: false,
								retryFileTasks: false,
								processingRequest: identity,
							},
						},
						tx,
					);
					return identity;
				});
			if (request)
				await services
					.getMediaProcessingService()
					.waitForTask(payload.mediaId, "thumbnail", request, owner);
		}

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
