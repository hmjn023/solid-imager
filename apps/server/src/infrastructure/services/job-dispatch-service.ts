import type { DeferredActions } from "@solid-imager/application/ports/media-service";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
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

export type ThumbnailJobHandlers = {
	deleteThumbnail: (mediaSourceId: string, mediaId: string) => Promise<void>;
	processThumbnailGenerationJob: (job: Job) => Promise<void>;
};

let thumbnailJobHandlers: ThumbnailJobHandlers | undefined;

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

// Helper for unified job processing (Called by JobWorker)
export async function processJob(job: Job) {
	const mediaSourceId = job.mediaSourceId;
	if (
		!mediaSourceId &&
		job.type !== "bulk_tagging_dispatch" &&
		job.type !== "batch_ccip_dispatch"
	) {
		throw new Error(`Job ${job.id} missing mediaSourceId`);
	}

	if (job.type === "processMedia") {
		const { MediaProcessingService } = await import(
			"~/infrastructure/services/media-processing-service"
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
	} else if (job.type === "generate_thumbnail") {
		await getThumbnailJobHandlers().processThumbnailGenerationJob(job);
	} else if (job.type === "source_export") {
		await processSourceExportJob(job);
	} else if (job.type === "source_restore") {
		return processSourceRestoreJob(job);
	} else {
		logger.warn({ jobId: job.id, type: job.type }, "Unknown job type");
	}
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
		const { deleteThumbnail } = getThumbnailJobHandlers();
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
