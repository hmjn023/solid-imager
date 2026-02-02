import { type Accessor, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

type MediaSourceEventsOptions = {
  enabled?: boolean | Accessor<boolean>;
  onMediaAdded?: (data: unknown) => void;
  onMediaDeleted?: (data: unknown) => void;
  onMediaChanged?: (data: unknown) => void;
  onMediaCopied?: (data: unknown) => void;
  onMediaMoved?: (data: unknown) => void;
  onThumbnailGenerated?: (data: unknown) => void;
  onAllJobsCompleted?: (data: unknown) => void;
  onWatcherError?: (data: unknown) => void;
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
          options.onMediaAdded?.(data);
          break;
        case "media-deleted":
          options.onMediaDeleted?.(data);
          break;
        case "media-changed":
          options.onMediaChanged?.(data);
          break;
        case "media-copied":
          options.onMediaCopied?.(data);
          break;
        case "media-moved":
          options.onMediaMoved?.(data);
          break;
        case "thumbnail-generated":
          options.onThumbnailGenerated?.(data);
          break;
        case "all-jobs-completed":
          options.onAllJobsCompleted?.(data);
          break;
        case "watcher-error":
          options.onWatcherError?.(data);
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
