import type { DeferredActions } from "@solid-imager/application/ports/media-service";
import { services } from "~/application/registry";
import type { Job as DbJob } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

// Helper for unified job processing (Called by JobWorker)
export async function processJob(job: DbJob) {
	const mediaSourceId = job.mediaSourceId;
	if (!mediaSourceId && job.type !== "bulk_tagging_dispatch") {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	if (job.type === "processMedia") {
		const { MediaProcessingService } = await import(
			"~/application/services/media-processing-service"
		);
		await MediaProcessingService.executeProcessMediaJob(job);
	} else if (job.type === "downloadImage") {
		const { processDownloadJob } = await import(
			"~/infrastructure/jobs/download-jobs"
		);
		await processDownloadJob(job);
	} else if (job.type === "auto_tagging") {
		await processAutoTaggingJob(job);
	} else if (job.type === "extract_ccip_vector") {
		const { processCcipExtractionJob } = await import(
			"~/infrastructure/jobs/ccip-jobs"
		);
		await processCcipExtractionJob(job);
	} else if (job.type === "bulk_tagging_dispatch") {
		await processBulkTaggingDispatchJob(job);
	} else if (job.type === "batch_ccip_dispatch") {
		const { processBatchCcipDispatchJob } = await import(
			"~/infrastructure/jobs/ccip-jobs"
		);
		await processBatchCcipDispatchJob(job);
	} else if (job.type === "sync_lancedb" || job.type === "sync_lancedb_full") {
		if (!mediaSourceId) {
			throw new Error(`Job ${job.id} missing mediaSourceId`);
		}
		const { BackupService } = await import(
			"~/application/services/backup-service"
		);
		await BackupService.syncSourceLanceDBCache(mediaSourceId);
	} else if (job.type === "sync_lancedb_delta") {
		if (!mediaSourceId) {
			throw new Error(`Job ${job.id} missing mediaSourceId`);
		}
		const { BackupService } = await import(
			"~/application/services/backup-service"
		);
		const batchSize = getDeltaBatchSize(job.payload);
		const payloadDirty = getDeltaDirtyPayload(job.payload);
		if (payloadDirty.mediaIds.length > 0) {
			await BackupService.queueSourceLanceDBDelta(
				mediaSourceId,
				payloadDirty.mediaIds,
				payloadDirty.operation,
				{ enqueueJob: false },
			);
		}
		await BackupService.syncSourceLanceDBDeltaCache(mediaSourceId, batchSize);
	} else {
		logger.warn({ jobId: job.id, type: job.type }, "Unknown job type");
	}
}

function getDeltaBatchSize(payload: unknown): number {
	if (
		payload &&
		typeof payload === "object" &&
		"batchSize" in payload &&
		typeof (payload as { batchSize: unknown }).batchSize === "number"
	) {
		return (payload as { batchSize: number }).batchSize;
	}
	return 500;
}

function getDeltaDirtyPayload(payload: unknown): {
	mediaIds: string[];
	operation: "upsert" | "delete";
} {
	if (!payload || typeof payload !== "object") {
		return { mediaIds: [], operation: "upsert" };
	}
	const data = payload as {
		mediaIds?: unknown;
		mediaId?: unknown;
		operation?: unknown;
	};
	const mediaIds = Array.isArray(data.mediaIds)
		? data.mediaIds.filter(
				(value): value is string => typeof value === "string",
			)
		: typeof data.mediaId === "string"
			? [data.mediaId]
			: [];
	const operation = data.operation === "delete" ? "delete" : "upsert";
	return { mediaIds, operation };
}

export async function executeDeferredActions(actions: DeferredActions) {
	if (actions.jobs.length > 0) {
		const repo = services.getJobRepository();
		for (const item of actions.jobs) {
			for (const job of item.jobs) {
				const jobPayload = {
					...(job.payload && typeof job.payload === "object"
						? job.payload
						: {}),
					mediaId: job.mediaId,
					sourcePath: job.sourcePath,
				};
				if (job.type === "sync_lancedb" || job.type === "sync_lancedb_delta") {
					await repo.createIfUnique({
						type: job.type,
						mediaSourceId: item.mediaSourceId,
						payload: jobPayload,
					});
					continue;
				}
				await repo.create({
					type: job.type,
					mediaSourceId: item.mediaSourceId,
					payload: jobPayload,
				});
			}
		}
	}
	if (actions.sourceEvents.length > 0) {
		for (const item of actions.sourceEvents) {
			RealtimeEventBus.publishSourceCommand(item.mediaSourceId, item);
		}
	}
	if (actions.filesToDelete && actions.filesToDelete.length > 0) {
		const storageService = services.getMediaStorage();
		for (const file of actions.filesToDelete) {
			try {
				await storageService.deleteFile(file.basePath, file.filePath);
			} catch (e) {
				logger.error(
					{ err: e, basePath: file.basePath, filePath: file.filePath },
					"Failed to delete file during deferred actions",
				);
			}
		}
	}
	if (actions.thumbnailsToDelete && actions.thumbnailsToDelete.length > 0) {
		for (const thumb of actions.thumbnailsToDelete) {
			try {
				await deleteThumbnail(thumb.mediaSourceId, thumb.mediaId);
			} catch (e) {
				logger.error(
					{
						err: e,
						mediaSourceId: thumb.mediaSourceId,
						mediaId: thumb.mediaId,
					},
					"Failed to delete thumbnail during deferred actions",
				);
			}
		}
	}
}
