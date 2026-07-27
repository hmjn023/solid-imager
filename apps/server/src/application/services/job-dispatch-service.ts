import type { DeferredActions } from "@solid-imager/application/ports/media-service";
import { validateJobPayload } from "@solid-imager/core/domain/jobs/registry";
import { createMediaSourceRevision } from "@solid-imager/core/domain/media/revision";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import { eq } from "drizzle-orm";
import { services } from "~/application/registry";
import { db } from "~/infrastructure/db";
import { medias } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { NonRetryableJobError } from "~/infrastructure/jobs/job-errors";
import { logger } from "~/infrastructure/logger";

// Helper for unified job processing (Called by JobWorker)
export async function processJob(job: Job, signal?: AbortSignal) {
	const validated = validateJobPayload(job.type, job.payload);
	if (!validated.success) {
		const issueSummary = validated.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		throw new NonRetryableJobError(
			validated.error.issues.some((issue) => issue.path[0] === "type")
				? "UNKNOWN_JOB_TYPE"
				: "INVALID_JOB_PAYLOAD",
			`Invalid ${job.type} job: ${issueSummary}`,
		);
	}
	if (signal?.aborted) return;
	await assertCurrentInputRevision(job);
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
			"~/application/services/media-processing-service"
		);
		await MediaProcessingService.executeProcessMediaJob(job);
	} else if (job.type === "downloadImage") {
		const { processDownloadJob } = await import(
			"~/infrastructure/jobs/download-jobs"
		);
		await processDownloadJob(job);
	} else if (job.type === "auto_tagging") {
		await processAutoTaggingJob(job, signal);
	} else if (job.type === "extract_ccip_vector") {
		const { processCcipExtractionJob } = await import(
			"~/infrastructure/jobs/ccip-jobs"
		);
		await processCcipExtractionJob(job, signal);
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
		await BackupService.syncSourceLanceDBDeltaCache(mediaSourceId, batchSize);
	} else {
		throw new NonRetryableJobError(
			"UNKNOWN_JOB_TYPE",
			`Unknown job type: ${job.type}`,
		);
	}
	if (!signal?.aborted) await assertCurrentInputRevision(job);
}

async function assertCurrentInputRevision(job: Job): Promise<void> {
	if (
		!job.inputRevision ||
		!["processMedia", "auto_tagging", "extract_ccip_vector"].includes(job.type)
	) {
		return;
	}
	const mediaId = job.targetId ?? getPayloadMediaId(job.payload);
	if (!mediaId) return;
	const [media] = await db
		.select({
			id: medias.id,
			mediaSourceId: medias.mediaSourceId,
			modifiedAt: medias.modifiedAt,
			fileSize: medias.fileSize,
			width: medias.width,
			height: medias.height,
		})
		.from(medias)
		.where(eq(medias.id, mediaId))
		.limit(1);
	if (!media) {
		throw new NonRetryableJobError(
			"TARGET_NOT_FOUND",
			`Job target media not found: ${mediaId}`,
		);
	}
	const currentRevision = await createMediaSourceRevision({
		mediaId: media.id,
		mediaSourceId: media.mediaSourceId,
		modifiedAt: media.modifiedAt,
		fileSize: media.fileSize,
		width: media.width,
		height: media.height,
	});
	if (currentRevision !== job.inputRevision) {
		throw new NonRetryableJobError(
			"STALE_INPUT",
			`Job input revision is stale for media ${mediaId}`,
		);
	}
}

function getPayloadMediaId(payload: unknown): string | null {
	if (!payload || typeof payload !== "object" || !("mediaId" in payload)) {
		return null;
	}
	return typeof payload.mediaId === "string" ? payload.mediaId : null;
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
					targetId: job.targetId,
					inputRevision: job.inputRevision,
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
