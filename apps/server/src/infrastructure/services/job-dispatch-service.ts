import type { DeferredActions } from "@solid-imager/application/media";
import { UnreconciledStorageError } from "@solid-imager/core/errors";
import type { Job } from "@solid-imager/core/jobs";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import {
	processSourceExportJob,
	processSourceRestoreJob,
} from "~/infrastructure/services/source-transfer-job-service";

/** Thumbnail operations injected into job dispatch to avoid a direct module dependency. */
export type ThumbnailJobHandlers = {
	deleteThumbnail: (mediaSourceId: string, mediaId: string) => Promise<void>;
	processThumbnailGenerationJob: (job: Job) => Promise<void>;
};

let thumbnailJobHandlers: ThumbnailJobHandlers | undefined;

/** Registers the thumbnail handlers required before thumbnail jobs or deletions run. */
export function configureThumbnailJobHandlers(
	handlers: ThumbnailJobHandlers,
): void {
	thumbnailJobHandlers = handlers;
}

function getThumbnailJobHandlers(): ThumbnailJobHandlers {
	if (!thumbnailJobHandlers) {
		throw new Error("Thumbnail job handlers have not been configured.");
	}
	return thumbnailJobHandlers;
}

/** Dispatches a job to its type-specific handler; most types require a media source ID. */
export async function processJob(job: Job) {
	const mediaSourceId = job.mediaSourceId;
	if (
		!mediaSourceId &&
		job.type !== "bulk_tagging_dispatch" &&
		job.type !== "batch_ccip_dispatch" &&
		job.type !== "character_clustering" &&
		job.type !== "extract_embedding_batch"
	) {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	if (job.type === "character_clustering") {
		const { processCharacterClusteringJob } =
			await import("./character-clustering-job-service");
		return processCharacterClusteringJob(job, services.getJobRepository());
	} else if (job.type === "processMedia") {
		const { MediaProcessingService } =
			await import("~/infrastructure/services/media-processing-service");
		await MediaProcessingService.executeProcessMediaJob(job);
	} else if (job.type === "downloadImage") {
		const { processDownloadJob } =
			await import("~/infrastructure/jobs/download-jobs");
		await processDownloadJob(job);
	} else if (job.type === "auto_tagging") {
		await processAutoTaggingJob(job);
	} else if (job.type === "extract_embedding_vector") {
		const { processEmbeddingExtractionJob } =
			await import("~/infrastructure/jobs/embedding-jobs");
		await processEmbeddingExtractionJob(job);
	} else if (job.type === "extract_embedding_batch") {
		const { processEmbeddingBatchJob } =
			await import("~/infrastructure/jobs/embedding-jobs");
		await processEmbeddingBatchJob(job);
	} else if (job.type === "extract_ccip_vector") {
		const { processCcipExtractionJob } =
			await import("~/infrastructure/jobs/ccip-jobs");
		await processCcipExtractionJob(job);
	} else if (job.type === "bulk_tagging_dispatch") {
		await processBulkTaggingDispatchJob(job);
	} else if (job.type === "batch_ccip_dispatch") {
		const { processBatchCcipDispatchJob } =
			await import("~/infrastructure/jobs/ccip-jobs");
		await processBatchCcipDispatchJob(job);
	} else if (job.type === "generate_thumbnail") {
		await getThumbnailJobHandlers().processThumbnailGenerationJob(job);
	} else if (job.type === "source_export") {
		await processSourceExportJob(job);
	} else if (job.type === "source_restore") {
		return processSourceRestoreJob(job);
	} else {
		throw new Error("Unsupported job type");
	}
}

/** Persists queued jobs, attempts required cleanup, then publishes independent observer notifications. Failed cleanup requires reconciliation. */
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
				await repo.create({
					type: job.type,
					mediaSourceId: item.mediaSourceId,
					payload: jobPayload,
				});
			}
		}
	}
	const cleanupErrors: unknown[] = [];

	if (actions.filesToDelete && actions.filesToDelete.length > 0) {
		for (const file of actions.filesToDelete) {
			try {
				await services
					.getMediaStorage()
					.deleteFile(file.basePath, file.filePath);
			} catch (e) {
				cleanupErrors.push(e);
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
				await getThumbnailJobHandlers().deleteThumbnail(
					thumb.mediaSourceId,
					thumb.mediaId,
				);
			} catch (e) {
				cleanupErrors.push(e);
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
	for (const item of actions.sourceEvents) {
		try {
			RealtimeEventBus.publishSourceCommand(item.mediaSourceId, item);
		} catch (err) {
			logger.warn(
				{ err, mediaSourceId: item.mediaSourceId, event: item.event },
				"Deferred observer failed after committed media operation",
			);
		}
	}
	if (cleanupErrors.length) throw new UnreconciledStorageError(cleanupErrors);
}
