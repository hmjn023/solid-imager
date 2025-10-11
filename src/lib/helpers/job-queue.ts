/**
 * Job Queue - ジョブキュー / バックグラウンド処理
 * Feature 17.4: ジョブキュー / バックグラウンド処理
 */

export const JobQueue = {
  addThumbnailJob(_mediaId: string, _sourceId: string) {
    // TODO: Add thumbnail generation job to queue
    throw new Error("Not implemented");
  },

  async processNextJob() {
    // TODO: Process next job in queue
    throw new Error("Not implemented");
  },
};

export const SseManager = {
  sendEvent(_sourceId: string, _eventType: string, _data: unknown) {
    // TODO: Send SSE event to connected clients
    throw new Error("Not implemented");
  },

  monitorFileSystem(_sourceId: string, _path: string) {
    // TODO: Start chokidar filesystem monitoring
    throw new Error("Not implemented");
  },
};
