/**
 * EventService - SSE機能
 * Feature 4: SSE機能
 */

/**
 * Provides services for Server-Sent Events (SSE) functionalities,
 * primarily for real-time monitoring of file system changes and thumbnail generation progress.
 */
export const EventService = {
  /**
   * Starts SSE monitoring for a specific media source.
   * This typically involves setting up a file system watcher (e.g., chokidar) for local sources.
   * @param {string} _sourceId - The ID of the media source to monitor.
   * @returns {any} A stream or mechanism to receive real-time events.
   */
  startSseMonitoring(_sourceId: string) {
    // TODO: Start chokidar file system monitoring for local sources
    throw new Error("Not implemented");
  },

  /**
   * Retrieves an SSE stream for real-time updates on thumbnail generation progress.
   * @param {string} _sourceId - The ID of the media source for which to get progress events.
   * @returns {any} An SSE stream providing thumbnail progress updates.
   */
  getThumbnailProgressEvents(_sourceId: string) {
    // TODO: Get SSE stream for thumbnail generation progress
    throw new Error("Not implemented");
  },
};
