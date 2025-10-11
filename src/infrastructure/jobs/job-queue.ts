/**
 * Job Queue
 * Extracted from src/lib/helpers/job-queue.ts
 * Feature 17.4: ジョブキュー / バックグラウンド処理
 */

export const JobQueue = {
  addThumbnailJob(_mediaId: string, _sourceId: string): void {
    // TODO: Add thumbnail generation job to queue
    throw new Error("Not implemented");
  },

  processNextJob(): Promise<void> {
    // TODO: Process next job in queue
    throw new Error("Not implemented");
  },
};
