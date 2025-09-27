import { createSignal } from "solid-js";

// A very simple in-memory job queue and state manager for thumbnail generation.
// A more robust solution (e.g., using a proper job queue library like BullMQ)
// would be needed for a production system.

export type ThumbnailJob = {
  mediaId: string;
  sourcePath: string;
};

export type JobStats = {
  total: number;
  processed: number;
  errors: { file: string; reason: string }[];
  status: "idle" | "processing" | "completed";
};

const [stats, setStats] = createSignal<JobStats>({
  total: 0,
  processed: 0,
  errors: [],
  status: "idle",
});

let jobQueue: ThumbnailJob[] = [];

export const thumbnailJobStats = stats;

export function addJobsToQueue(jobs: ThumbnailJob[]) {
  jobQueue.push(...jobs);
  setStats((prev) => ({ ...prev, total: prev.total + jobs.length }));
}

export function startJobQueue(processor: (job: ThumbnailJob) => Promise<void>) {
  if (stats().status === "processing") {
    console.warn("Job queue is already running.");
    return;
  }

  setStats((prev) => ({ ...prev, status: "processing" }));

  const run = async () => {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift()!;
      try {
        await processor(job);
      } catch (e: any) {
        setStats((prev) => ({
          ...prev,
          errors: [...prev.errors, { file: job.mediaId, reason: e.message }],
        }));
      }
      setStats((prev) => ({ ...prev, processed: prev.processed + 1 }));
    }

    setStats((prev) => ({ ...prev, status: "completed" }));
  };

  run();
}

export function resetJobQueue() {
  jobQueue = [];
  setStats({
    total: 0,
    processed: 0,
    errors: [],
    status: "idle",
  });
}
