import { SseManager } from "./sse-manager";

/**
 * Represents a single background job.
 * @property {string} mediaId - The ID of the media item for the job.
 * @property {string} sourcePath - The source path of the media file.
 * @property {string} type - The type of job to perform.
 *   - 'processMedia': Unified job type (recommended). Handles metadata extraction,
 *     thumbnail generation, and optional AI tagging in a single job.
 *   - 'thumbnail': @deprecated Use 'processMedia' instead.
 *   - 'extractTags': @deprecated Use 'processMedia' instead.
 *   - 'downloadImage': @deprecated Use 'processMedia' instead.
 * @property {object} [payload] - Optional payload for the job (e.g., download metadata).
 */
export type Job = {
  mediaId: string;
  sourcePath: string;
  /**
   * The type of job. Use 'processMedia' for unified processing.
   * @deprecated 'thumbnail', 'extractTags', 'downloadImage' are deprecated.
   * Use 'processMedia' with MediaProcessingService.executeProcessMediaJob instead.
   */
  type: "processMedia" | "thumbnail" | "extractTags" | "downloadImage";
  payload?: {
    imageUrl?: string;
    sourceUrl?: string;
    description?: string;
    createdAt?: Date;
    /**
     * If true, skips metadata extraction and AI tagging.
     * Useful for restoration jobs where metadata is already populated.
     */
    skipMetadataExtraction?: boolean;
  };
};

/**
 * Represents the statistics and status of a job queue for a specific source.
 * @property {number} total - The total number of jobs in the queue.
 * @property {number} processed - The number of jobs that have been processed.
 * @property {{ file: string; reason: string }[]} errors - An array of errors encountered during job processing.
 * @property {"idle" | "processing" | "completed"} status - The current status of the job queue.
 */
export type JobStats = {
  total: number;
  processed: number;
  errors: { file: string; reason: string }[];
  status: "idle" | "processing" | "completed";
};

// mediaSourceIdごとのジョブ統計を保存するためにMapを使用します。
const jobStatsMap = new Map<string, JobStats>();
const jobQueueMap = new Map<string, Job[]>();

/**
 * Initializes job statistics for a given source ID.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {JobStats} The initialized job statistics object.
 */
function initializeJobStats(mediaSourceId: string): JobStats {
  const newStats = {
    total: 0,
    processed: 0,
    errors: [],
    status: "idle" as "idle" | "processing" | "completed",
  };
  jobStatsMap.set(mediaSourceId, newStats);
  return newStats;
}

/**
 * Retrieves the current job statistics for a given source ID.
 * If no stats exist for the source, it initializes them.
 * @param {string} mediaSourceId - The ID of the media source.
 * @returns {JobStats} The job statistics object for the specified source.
 */
export function getJobStats(mediaSourceId: string): JobStats {
  return jobStatsMap.get(mediaSourceId) || initializeJobStats(mediaSourceId);
}

/**
 * Adds a list of jobs to the queue for a specific source.
 * Updates the job statistics accordingly.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {Job[]} jobs - An array of jobs to add.
 */
export function addJobsToQueue(mediaSourceId: string, jobs: Job[]) {
  const currentQueue = jobQueueMap.get(mediaSourceId) || [];
  jobQueueMap.set(mediaSourceId, [...currentQueue, ...jobs]);

  const currentStats = getJobStats(mediaSourceId);
  jobStatsMap.set(mediaSourceId, {
    ...currentStats,
    total: currentStats.total + jobs.length,
  });
}

/**
 * Starts processing the job queue for a specific source.
 * @param {string} mediaSourceId - The ID of the media source.
 * @param {(job: Job) => Promise<void>} processor - The function to process each job.
 */
export function startJobQueue(
  mediaSourceId: string,
  processor: (job: Job) => Promise<void>,
  concurrencyLimit = 1000
) {
  const currentStats = getJobStats(mediaSourceId);
  if (currentStats.status === "processing") {
    return;
  }

  jobStatsMap.set(mediaSourceId, { ...currentStats, status: "processing" });

  const run = async () => {
    const activeJobs = new Set<Promise<void>>();
    await processQueue(mediaSourceId, processor, activeJobs, concurrencyLimit);
  };

  run();
}

async function processQueue(
  mediaSourceId: string,
  processor: (job: Job) => Promise<void>,
  activeJobs: Set<Promise<void>>,
  concurrencyLimit: number
) {
  let queue = jobQueueMap.get(mediaSourceId) || [];

  while (queue.length > 0 || activeJobs.size > 0) {
    // Fill the active jobs up to the limit
    while (queue.length > 0 && activeJobs.size < concurrencyLimit) {
      const job = queue.shift();
      if (!job) {
        break;
      }

      const jobPromise = (async () => {
        try {
          await processor(job);
        } catch (e: unknown) {
          const stats = getJobStats(mediaSourceId);
          jobStatsMap.set(mediaSourceId, {
            ...stats,
            errors: [
              ...stats.errors,
              { file: job.mediaId, reason: (e as Error).message },
            ],
          });
        } finally {
          const stats = getJobStats(mediaSourceId);
          jobStatsMap.set(mediaSourceId, {
            ...stats,
            processed: stats.processed + 1,
          });
        }
      })();

      // Add to active set and remove when done
      const promiseWithCleanup = jobPromise.then(() => {
        activeJobs.delete(promiseWithCleanup);
      });
      activeJobs.add(promiseWithCleanup);

      // Refresh queue reference
      queue = jobQueueMap.get(mediaSourceId) || [];
    }

    // Wait for at least one job to finish if we are at capacity or queue is empty but jobs are running
    if (activeJobs.size > 0) {
      await Promise.race(activeJobs);
    }

    // Refresh queue reference again
    queue = jobQueueMap.get(mediaSourceId) || [];
  }

  const stats = getJobStats(mediaSourceId);
  jobStatsMap.set(mediaSourceId, { ...stats, status: "completed" });

  SseManager.sendEvent(mediaSourceId, "all-jobs-completed", {
    total: stats.total,
    processed: stats.processed,
    errors: stats.errors.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Resets the job queue and statistics for a specific source.
 * @param {string} mediaSourceId - The ID of the media source.
 */
export function resetJobQueue(mediaSourceId: string) {
  jobQueueMap.delete(mediaSourceId);
  jobStatsMap.delete(mediaSourceId);
}
