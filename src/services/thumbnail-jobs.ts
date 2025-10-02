import { createSignal } from "solid-js";

// サムネイル生成のための非常にシンプルなインメモリジョブキューおよび状態マネージャー。
// より堅牢なソリューション（例: BullMQのような適切なジョブキューライブラリの使用）
// は、本番システムには必要となるでしょう。

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

// sourceIdごとのジョブ統計を保存するためにMapを使用します。
const jobStatsMap = new Map<string, JobStats>();
const jobQueueMap = new Map<string, ThumbnailJob[]>();

function initializeJobStats(sourceId: string): JobStats {
  const newStats = {
    total: 0,
    processed: 0,
    errors: [],
    status: "idle" as "idle" | "processing" | "completed",
  };
  jobStatsMap.set(sourceId, newStats);
  return newStats;
}

export function getThumbnailJobStats(sourceId: string): JobStats {
  return jobStatsMap.get(sourceId) || initializeJobStats(sourceId);
}

export function addJobsToQueue(sourceId: string, jobs: ThumbnailJob[]) {
  const currentQueue = jobQueueMap.get(sourceId) || [];
  jobQueueMap.set(sourceId, [...currentQueue, ...jobs]);

  const currentStats = getThumbnailJobStats(sourceId);
  jobStatsMap.set(sourceId, { ...currentStats, total: currentStats.total + jobs.length });
}

export function startJobQueue(sourceId: string, processor: (job: ThumbnailJob) => Promise<void>) {
  const currentStats = getThumbnailJobStats(sourceId);
  if (currentStats.status === "processing") {
    console.warn(`Job queue for source ${sourceId} is already running.`);
    return;
  }

  jobStatsMap.set(sourceId, { ...currentStats, status: "processing" });

  const run = async () => {
    let queue = jobQueueMap.get(sourceId) || [];
    while (queue.length > 0) {
      const job = queue.shift()!;
      try {
        await processor(job);
      } catch (e: any) {
        const stats = getThumbnailJobStats(sourceId);
        jobStatsMap.set(sourceId, {
          ...stats,
          errors: [...stats.errors, { file: job.mediaId, reason: e.message }],
        });
      }
      const stats = getThumbnailJobStats(sourceId);
      jobStatsMap.set(sourceId, { ...stats, processed: stats.processed + 1 });
      queue = jobQueueMap.get(sourceId) || []; // キューが変更された場合に備えて、キューを再フェッチします。
    }

    const stats = getThumbnailJobStats(sourceId);
    jobStatsMap.set(sourceId, { ...stats, status: "completed" });
  };

  run();
}

export function resetJobQueue(sourceId: string) {
  jobQueueMap.delete(sourceId);
  jobStatsMap.delete(sourceId);
}