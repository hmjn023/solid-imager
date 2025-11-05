/**
 * Job Queue Manager
 * Extracted from src/services/thumbnail-jobs.ts
 * Simple in-memory job queue and state manager for background jobs
 */

/**
 * Represents a single background job.
 * @property {string} mediaId - The ID of the media item for the job.
 * @property {string} sourcePath - The source path of the media file.
 * @property {'thumbnail' | 'extractTags'} type - The type of job to perform.
 */
export type Job = {
  mediaId: string;
  sourcePath: string;
  type: "thumbnail" | "extractTags";
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
  processor: (job: Job) => Promise<void>
) {
  const currentStats = getJobStats(mediaSourceId);
  if (currentStats.status === "processing") {
    return;
  }

  jobStatsMap.set(mediaSourceId, { ...currentStats, status: "processing" });

  const run = async () => {
    let queue = jobQueueMap.get(mediaSourceId) || [];
    while (queue.length > 0) {
      const job = queue.shift();
      try {
        await processor(job);
      } catch (e: unknown) {
        const stats = getJobStats(mediaSourceId);
        jobStatsMap.set(mediaSourceId, {
          ...stats,
          errors: [...stats.errors, { file: job.mediaId, reason: e.message }],
        });
      }
      const stats = getJobStats(mediaSourceId);
      jobStatsMap.set(mediaSourceId, {
        ...stats,
        processed: stats.processed + 1,
      });
      queue = jobQueueMap.get(mediaSourceId) || []; // キューが変更された場合に備えて、キューを再フェッチします。
    }

    const stats = getJobStats(mediaSourceId);
    jobStatsMap.set(mediaSourceId, { ...stats, status: "completed" });
  };

  run();
}

/**
 * Resets the job queue and statistics for a specific source.
 * @param {string} mediaSourceId - The ID of the media source.
 */
export function resetJobQueue(mediaSourceId: string) {
  jobQueueMap.delete(mediaSourceId);
  jobStatsMap.delete(mediaSourceId);
}
