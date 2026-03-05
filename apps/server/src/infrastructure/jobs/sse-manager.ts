import { EventEmitter } from "node:events";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

// Regex to ignore dotfiles in file system watcher
const IGNORE_DOTFILES_REGEX = /(^|[/\\])\../;

type SseClient = {
  controller: ReadableStreamDefaultController;
  id: string;
};

type FileWatcher = {
  watcher: FSWatcher;
  path: string;
};

// mediaSourceId -> Set of clients
// HMR survival: use global map if available
// biome-ignore lint/suspicious/noExplicitAny: Global augmentation for HMR
const globalAny = globalThis as any;

if (!globalAny.__SSE_CLIENTS_MAP__) {
  globalAny.__SSE_CLIENTS_MAP__ = new Map<string, Set<SseClient>>();
}
const clientsMap: Map<string, Set<SseClient>> = globalAny.__SSE_CLIENTS_MAP__;

// mediaSourceId -> FileWatcher
if (!globalAny.__SSE_WATCHERS_MAP__) {
  globalAny.__SSE_WATCHERS_MAP__ = new Map<string, FileWatcher>();
}
const watchersMap: Map<string, FileWatcher> = globalAny.__SSE_WATCHERS_MAP__;

// Event emitter for internal subscriptions (oRPC, etc.)
const DEFAULT_MAX_LISTENERS = 100;
if (!globalAny.__SSE_EVENT_EMITTER__) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(DEFAULT_MAX_LISTENERS);
  globalAny.__SSE_EVENT_EMITTER__ = emitter;
}
const eventEmitter: EventEmitter = globalAny.__SSE_EVENT_EMITTER__;

// Cleanup on process exit
if (!globalAny.__SSE_CLEANUP_REGISTERED__) {
  const cleanup = async () => {
    // console.log("[SseManager] Cleaning up watchers...");
    const watchers = globalAny.__SSE_WATCHERS_MAP__ as Map<string, FileWatcher>;
    if (watchers) {
      const closePromises = Array.from(watchers.values()).map((fw) =>
        fw.watcher.close()
      );
      await Promise.all(closePromises);
      watchers.clear();
    }
  };

  process.on("SIGINT", async () => {
    await cleanup();
  });

  process.on("SIGTERM", async () => {
    await cleanup();
  });

  globalAny.__SSE_CLEANUP_REGISTERED__ = true;
}

/**
 * Manages Server-Sent Events (SSE) for real-time updates to connected clients.
 */
export const SseManager = {
  /**
   * Internal event emitter
   */
  emitter: eventEmitter,
  /**
   * Adds a new client to the SSE manager for a specific media source.
   * @param {string} mediaSourceId - The ID of the media source.
   * @param {ReadableStreamDefaultController} controller - The stream controller for the client.
   * @returns {string} The unique ID of the added client.
   */
  addClient(
    mediaSourceId: string,
    controller: ReadableStreamDefaultController
  ): string {
    const clientId = crypto.randomUUID();
    const client: SseClient = { controller, id: clientId };

    if (!clientsMap.has(mediaSourceId)) {
      clientsMap.set(mediaSourceId, new Set());
    }
    clientsMap.get(mediaSourceId)?.add(client);

    return clientId;
  },

  /**
   * Removes a client from the SSE manager.
   * @param {string} mediaSourceId - The ID of the media source.
   * @param {string} clientId - The ID of the client to remove.
   */
  removeClient(mediaSourceId: string, clientId: string): void {
    const clients = clientsMap.get(mediaSourceId);
    if (clients) {
      for (const client of clients) {
        if (client.id === clientId) {
          clients.delete(client);
          break;
        }
      }
      if (clients.size === 0) {
        clientsMap.delete(mediaSourceId);
      }
    }
  },

  /**
   * Sends an SSE event to connected clients for a specific media source.
   * @param {string} mediaSourceId - The ID of the media source related to the event.
   * @param {string} eventType - The type of the event (e.g., "thumbnail-generated", "media-added", "media-deleted", "media-changed").
   * @param {unknown} data - The data payload of the event.
   */
  sendEvent(mediaSourceId: string, eventType: string, data: unknown): void {
    // Notify through internal emitter first
    eventEmitter.emit(`event:${mediaSourceId}`, { event: eventType, data });

    const clients = clientsMap.get(mediaSourceId);
    if (!clients) {
      return;
    }

    const payload = JSON.stringify(data);
    const message = `event: ${eventType}\ndata: ${payload}\n\n`;
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    for (const client of clients) {
      try {
        client.controller.enqueue(encodedMessage);
      } catch (_error) {
        // Error already logged by callback
        this.removeClient(mediaSourceId, client.id);
      }
    }
  },

  /**
   * Starts file system monitoring for a specific media source to generate SSE events.
   * Monitors for file additions, deletions, and changes.
   * @param {string} mediaSourceId - The ID of the media source to monitor.
   * @param {string} watchPath - The file system path to monitor.
   * @param {object} options - Optional configuration for the watcher.
   * @param {(filePath: string) => Promise<void>} options.onAdd - Callback for file additions.
   * @param {(filePath: string) => Promise<void>} options.onDelete - Callback for file deletions.
   * @param {(filePath: string) => Promise<void>} options.onChange - Callback for file changes.
   */
  startFileSystemMonitoring(
    mediaSourceId: string,
    watchPath: string,
    options?: {
      onAdd?: (filePath: string) => Promise<void>;
      onDelete?: (filePath: string) => Promise<void>;
      onChange?: (filePath: string) => Promise<void>;
    }
  ): void {
    // Stop existing watcher if any
    this.stopFileSystemMonitoring(mediaSourceId);

    // Create new watcher
    const watcher = chokidar.watch(watchPath, {
      ignored: IGNORE_DOTFILES_REGEX, // ignore dotfiles
      persistent: true,
      ignoreInitial: true, // Don't trigger events for existing files
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    // File added
    watcher.on("add", async (filePath: string) => {
      const relativePath = path.relative(watchPath, filePath);

      // Execute callback if provided
      if (options?.onAdd) {
        try {
          await options.onAdd(relativePath);
        } catch (_error) {
          // Error already logged by callback
        }
      }

      // Send SSE event
      this.sendEvent(mediaSourceId, "media-added", {
        filePath: relativePath,
        timestamp: new Date().toISOString(),
      });
    });

    // File deleted
    watcher.on("unlink", async (filePath: string) => {
      const relativePath = path.relative(watchPath, filePath);

      // Execute callback if provided
      if (options?.onDelete) {
        try {
          await options.onDelete(relativePath);
        } catch (_error) {
          // Error already logged by callback
        }
      }

      // Send SSE event
      this.sendEvent(mediaSourceId, "media-deleted", {
        filePath: relativePath,
        timestamp: new Date().toISOString(),
      });
    });

    // File changed
    watcher.on("change", async (filePath: string) => {
      const relativePath = path.relative(watchPath, filePath);

      // Execute callback if provided
      if (options?.onChange) {
        try {
          await options.onChange(relativePath);
        } catch (_error) {
          // Error already logged by callback
        }
      }

      // Send SSE event
      this.sendEvent(mediaSourceId, "media-changed", {
        filePath: relativePath,
        timestamp: new Date().toISOString(),
      });
    });

    // Error handling
    watcher.on("error", (error) => {
      this.sendEvent(mediaSourceId, "watcher-error", {
        error: String(error),
        timestamp: new Date().toISOString(),
      });
    });

    // Store watcher
    watchersMap.set(mediaSourceId, { watcher, path: watchPath });
  },

  /**
   * Stops file system monitoring for a specific media source.
   * @param {string} mediaSourceId - The ID of the media source.
   */
  async stopFileSystemMonitoring(mediaSourceId: string): Promise<void> {
    const fileWatcher = watchersMap.get(mediaSourceId);
    if (fileWatcher) {
      await fileWatcher.watcher.close();
      watchersMap.delete(mediaSourceId);
    }
  },

  /**
   * Gets the list of monitored media source IDs.
   * @returns {string[]} Array of media source IDs currently being monitored.
   */
  getMonitoredSources(): string[] {
    return Array.from(watchersMap.keys());
  },

  /**
   * Checks if a media source is currently being monitored.
   * @param {string} mediaSourceId - The ID of the media source.
   * @returns {boolean} True if the source is being monitored.
   */
  isMonitoring(mediaSourceId: string): boolean {
    return watchersMap.has(mediaSourceId);
  },

  /**
   * Notifies clients that a media item has been copied.
   * @param {string} sourceId - The source media source ID.
   * @param {string} targetId - The target media source ID.
   * @param {object} media - The copied media item.
   */
  notifyMediaCopied(sourceId: string, targetId: string, media: unknown): void {
    // Notify target source about new item
    this.sendEvent(targetId, "media-copied", {
      sourceId,
      media,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Notifies clients that a media item has been moved.
   * @param {string} sourceId - The source media source ID.
   * @param {string} targetId - The target media source ID.
   * @param {string} mediaId - The ID of the moved media.
   * @param {object} media - The moved media item (in new location).
   */
  notifyMediaMoved(
    sourceId: string,
    targetId: string,
    mediaId: string,
    media: unknown
  ): void {
    // Notify source about deletion
    this.sendEvent(sourceId, "media-moved", {
      type: "source",
      mediaId,
      targetId,
      timestamp: new Date().toISOString(),
    });

    // Notify target about addition
    this.sendEvent(targetId, "media-moved", {
      type: "target",
      media,
      sourceId,
      timestamp: new Date().toISOString(),
    });
  },
};
