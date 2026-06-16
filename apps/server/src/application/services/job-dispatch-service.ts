import { services } from "~/application/registry";
import type { Job as DbJob } from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

export type DeferredJob = {
	// Fields for constructing a job
	mediaId?: string;
	sourcePath?: string;
	type: "processMedia" | "downloadImage" | "sync_lancedb";
	payload?: unknown;
};

export type DeferredJobs = {
	mediaSourceId: string;
	jobs: DeferredJob[];
};

export type DeferredSse = {
	mediaSourceId: string;
	event: string;
	payload: unknown;
};

export type FileToDelete = {
	basePath: string;
	filePath: string;
};

export type ThumbnailToDelete = {
	mediaSourceId: string;
	mediaId: string;
};

export type DeferredActions = {
	jobs: DeferredJobs[];
	sse: DeferredSse[];
	filesToDelete?: FileToDelete[];
	thumbnailsToDelete?: ThumbnailToDelete[];
};

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
		// Queue LanceDB sync job
		try {
			const repo = services.getJobRepository();
			await repo.createIfUnique({
				type: "sync_lancedb",
				mediaSourceId,
				payload: {},
			});
		} catch (e) {
			logger.error(
				{ err: e, mediaSourceId },
				"Failed to queue sync_lancedb after processMedia",
			);
		}
	} else if (job.type === "downloadImage") {
		const { processDownloadJob } = await import(
			"~/infrastructure/jobs/download-jobs"
		);
		await processDownloadJob(job);
	} else if (job.type === "auto_tagging") {
		await processAutoTaggingJob(job);
		// Queue LanceDB sync job
		try {
			const repo = services.getJobRepository();
			await repo.createIfUnique({
				type: "sync_lancedb",
				mediaSourceId,
				payload: {},
			});
		} catch (e) {
			logger.error(
				{ err: e, mediaSourceId },
				"Failed to queue sync_lancedb after auto_tagging",
			);
		}
	} else if (job.type === "bulk_tagging_dispatch") {
		await processBulkTaggingDispatchJob(job);
	} else if (job.type === "sync_lancedb") {
		if (!mediaSourceId) {
			throw new Error(`Job ${job.id} missing mediaSourceId`);
		}
		const { BackupService } = await import(
			"~/application/services/backup-service"
		);
		await BackupService.syncSourceLanceDBCache(mediaSourceId);
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
				if (job.type === "sync_lancedb") {
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
	if (actions.sse.length > 0) {
		for (const item of actions.sse) {
			SseManager.sendEvent(item.mediaSourceId, item.event, item.payload);
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
