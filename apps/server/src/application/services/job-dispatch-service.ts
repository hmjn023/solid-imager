import type { JobRecord } from "@solid-imager/application/ports/job-repository";
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

export type DeferredActions = {
	jobs: DeferredJobs[];
	sse: DeferredSse[];
};

// Helper for unified job processing (Called by JobWorker)
export async function processJob(job: JobRecord) {
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
		await processDownloadJob(job as DbJob);
	} else if (job.type === "auto_tagging") {
		await processAutoTaggingJob(job as DbJob);
	} else if (job.type === "bulk_tagging_dispatch") {
		await processBulkTaggingDispatchJob(job as DbJob);
	} else {
		logger.warn({ jobId: job.id, type: job.type }, "Unknown job type");
	}
}

export async function executeDeferredActions(actions: DeferredActions) {
	if (actions.jobs.length > 0) {
		const repo = services.getJobRepository();
		for (const item of actions.jobs) {
			for (const job of item.jobs) {
				const payload =
					typeof job.payload === "object" && job.payload !== null
						? job.payload
						: {};
				await repo.create({
					type: job.type,
					mediaSourceId: item.mediaSourceId,
					payload: {
						...payload,
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
