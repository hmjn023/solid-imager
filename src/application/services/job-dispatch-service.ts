import {
  addJobsToQueue,
  type Job,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";

export type DeferredJobs = {
  mediaSourceId: string;
  jobs: Job[];
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

// Helper for unified job processing
export async function processJob(job: Job, mediaSourceId: string) {
  if (job.type === "processMedia") {
    const { MediaProcessingService } = await import(
      "~/application/services/media-processing-service"
    );
    await MediaProcessingService.executeProcessMediaJob(job, mediaSourceId);
  } else if (job.type === "downloadImage") {
    const { processDownloadJob } = await import(
      "~/infrastructure/jobs/download-jobs"
    );
    await processDownloadJob(job, mediaSourceId);
  }
}

export function executeDeferredActions(actions: DeferredActions) {
  if (actions.jobs.length > 0) {
    for (const item of actions.jobs) {
      addJobsToQueue(item.mediaSourceId, item.jobs);
      startJobQueue(item.mediaSourceId, (job) =>
        processJob(job, item.mediaSourceId)
      );
    }
  }
  if (actions.sse.length > 0) {
    for (const item of actions.sse) {
      SseManager.sendEvent(item.mediaSourceId, item.event, item.payload);
    }
  }
}
