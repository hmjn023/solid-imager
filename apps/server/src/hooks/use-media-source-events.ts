import { type Accessor, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

export type MediaAddedEvent = {
  filePath: string;
  mediaId?: string;
  timestamp?: string;
};

export type MediaDeletedEvent = {
  filePath: string;
  timestamp?: string;
};

export type MediaChangedEvent = {
  filePath: string;
  mediaId?: string;
  timestamp?: string;
};

export type MediaCopiedEvent = {
  sourceId: string;
  media: unknown;
  timestamp: string;
};

export type MediaMovedEvent = {
  type: "source" | "target";
  mediaId?: string;
  targetId?: string;
  media?: unknown;
  sourceId?: string;
  timestamp: string;
};

export type ThumbnailGeneratedEvent = {
  mediaId: string;
};

export type AllJobsCompletedEvent = {
  processed: number;
};

export type WatcherErrorEvent = {
  error?: string;
};

type MediaSourceEventsOptions = {
  enabled?: boolean | Accessor<boolean>;
  onMediaAdded?: (data: MediaAddedEvent) => void;
  onMediaDeleted?: (data: MediaDeletedEvent) => void;
  onMediaChanged?: (data: MediaChangedEvent) => void;
  onMediaCopied?: (data: MediaCopiedEvent) => void;
  onMediaMoved?: (data: MediaMovedEvent) => void;
  onThumbnailGenerated?: (data: ThumbnailGeneratedEvent) => void;
  onAllJobsCompleted?: (data: AllJobsCompletedEvent) => void;
  onWatcherError?: (data: WatcherErrorEvent) => void;
};

/**
 * Hook to subscribe to SSE events for a specific media source.
 * Handles connection management, cleanup, and event dispatching.
 */
export function useMediaSourceEvents(
  mediaSourceId: Accessor<string | undefined>,
  options: MediaSourceEventsOptions = {}
) {
  createEffect(() => {
    if (isServer) {
      return;
    }

    const id = mediaSourceId();
    const isEnabled =
      typeof options.enabled === "function"
        ? options.enabled()
        : (options.enabled ?? true);

    if (!(id && isEnabled)) {
      return;
    }

    const ac = new AbortController();

    const handleEvent = (event: string, data: unknown) => {
      switch (event) {
        case "media-added":
          options.onMediaAdded?.(data as MediaAddedEvent);
          break;
        case "media-deleted":
          options.onMediaDeleted?.(data as MediaDeletedEvent);
          break;
        case "media-changed":
          options.onMediaChanged?.(data as MediaChangedEvent);
          break;
        case "media-copied":
          options.onMediaCopied?.(data as MediaCopiedEvent);
          break;
        case "media-moved":
          options.onMediaMoved?.(data as MediaMovedEvent);
          break;
        case "thumbnail-generated":
          options.onThumbnailGenerated?.(data as ThumbnailGeneratedEvent);
          break;
        case "all-jobs-completed":
          options.onAllJobsCompleted?.(data as AllJobsCompletedEvent);
          break;
        case "watcher-error":
          options.onWatcherError?.(data as WatcherErrorEvent);
          break;
        case "connected":
          // Connection established
          break;
        default:
          logger.debug({ event, data }, "Unknown event received");
          break;
      }
    };

    const startEventStream = async () => {
      try {
        const events = await orpc.sources.events({ id }, { signal: ac.signal });

        for await (const msg of events) {
          if (ac.signal.aborted) {
            break;
          }

          const { event, data } = msg;
          handleEvent(event, data);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          logger.error({ err }, "Event stream error");
          // TODO: Implement retry logic if needed
        }
      }
    };

    startEventStream();

    onCleanup(() => {
      ac.abort();
    });
  });
}
