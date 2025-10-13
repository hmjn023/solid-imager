/**
 * EventService - SSE機能
 * Feature 4: SSE機能
 */

export const EventService = {
  // Feature 4: SSE機能 - local type sources only
  async startSseMonitoring(_sourceId: string) {
    // TODO: Start chokidar file system monitoring for local sources
    throw new Error("Not implemented");
  },

  async getThumbnailProgressEvents(_sourceId: string) {
    // TODO: Get SSE stream for thumbnail generation progress
    throw new Error("Not implemented");
  },
};
