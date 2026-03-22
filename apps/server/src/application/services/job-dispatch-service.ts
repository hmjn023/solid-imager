import { services } from "~/application/registry";
import type { Job as DbJob } from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";
import { logger } from "~/infrastructure/logger";

export type DeferredJob = {
	// Fields for constructing a job
	mediaId?: string;
	sourcePath?: string;
	type: "processMedia" | "downloadImage";
	// biome-ignore lint/suspicious/noExplicitAny: Flexible payload
	payload?: any;
};

export type DeferredJobs = {
	mediaSourceId: string;
	jobs: DeferredJob[];
};

export type DeferredSse = {
	mediaSourceId: string;
	event: string;
	// biome-ignore lint/suspicious/noExplicitAny: SSE payload is flexible
	payload: any;
};

export type DeferredActions = {
	jobs: DeferredJobs[];
	sse: DeferredSse[];
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
	} else if (job.type === "downloadImage") {
		const { processDownloadJob } = await import(
			"~/infrastructure/jobs/download-jobs"
		);
		await processDownloadJob(job);
	} else if (job.type === "auto_tagging") {
		await processAutoTaggingJob(job);
	} else if (job.type === "bulk_tagging_dispatch") {
		await processBulkTaggingDispatchJob(job);
	} else {
		logger.warn({ jobId: job.id, type: job.type }, "Unknown job type");
	}
}

export async function executeDeferredActions(actions: DeferredActions) {
	if (actions.jobs.length > 0) {
		const repo = services.getJobRepository();
		for (const item of actions.jobs) {
			for (const job of item.jobs) {
				await repo.create({
					type: job.type,
					mediaSourceId: item.mediaSourceId,
					payload: {
						...job.payload,
						mediaId: job.mediaId,
						sourcePath: job.sourcePath,
					},
				});
			}
		}
	}
	if (actions.sse.length > 0) {
		for (const item of actions.sse) {
			SseManager.sendEvent(item.mediaSourceId, item.event, item.payload);
		}
	}
}
