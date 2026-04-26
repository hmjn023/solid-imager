import {
	createJobDispatcher,
	type DeferredActions,
	executeDeferredActions as executeSharedDeferredActions,
} from "@solid-imager/application/services/job-runtime";
import { services } from "~/application/registry";
import type { Job as DbJob } from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";
import { logger } from "~/infrastructure/logger";

export const processJob = createJobDispatcher(
	{
		processMedia: async (job) => {
			const mediaSourceId = job.mediaSourceId;
			if (!mediaSourceId) {
				throw new Error(`Job ${job.id} missing mediaSourceId`);
			}
			const { MediaProcessingService } = await import(
				"~/application/services/media-processing-service"
			);
			await MediaProcessingService.executeProcessMediaJob(job);
		},
		downloadImage: async (job) => {
			if (!job.mediaSourceId) {
				throw new Error(`Job ${job.id} missing mediaSourceId`);
			}
			const { processDownloadJob } = await import(
				"~/infrastructure/jobs/download-jobs"
			);
			await processDownloadJob(job as DbJob);
		},
		auto_tagging: async (job) => {
			if (!job.mediaSourceId) {
				throw new Error(`Job ${job.id} missing mediaSourceId`);
			}
			await processAutoTaggingJob(job as DbJob);
		},
		bulk_tagging_dispatch: async (job) => {
			await processBulkTaggingDispatchJob(job as DbJob);
		},
	},
	logger,
);

export async function executeDeferredActions(actions: DeferredActions) {
	await executeSharedDeferredActions(actions, {
		jobRepository: services.getJobRepository(),
		publishEvent: (event) => {
			SseManager.sendEvent(event.mediaSourceId, event.event, event.payload);
		},
	});
}
