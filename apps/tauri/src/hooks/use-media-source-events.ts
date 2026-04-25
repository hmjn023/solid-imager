import {
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
import { listen } from "@tauri-apps/api/event";
import type { Accessor } from "solid-js";

export type {
	AllJobsCompletedEvent,
	JobProgressEvent,
	MediaAddedEvent,
	MediaChangedEvent,
	MediaCopiedEvent,
	MediaDeletedEvent,
	MediaMovedEvent,
	ThumbnailGeneratedEvent,
	WatcherErrorEvent,
} from "@solid-imager/ui/hooks/use-media-source-events";

type MediaSourceEventsOptions = Omit<UseMediaSourceEventsOptions, "transport">;

/**
 * Tauri-side thin wrapper around the shared `useMediaSourceEvents` hook.
 *
 * Creates a Tauri event-bus transport scoped to `mediaSourceId` and injects it
 * into the shared hook. Each call to `transport.listen` registers one Tauri
 * event listener per event name and fans out to the shared handler, filtering
 * events to those relevant for the current `mediaSourceId`.
 */
export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport: MediaSourceEventTransport = {
		listen(handler) {
			// Reading `mediaSourceId()` synchronously here is intentional:
			// this function is called inside the shared hook's `createEffect`,
			// so Solid tracks it and re-runs the effect when the id changes.
			const id = mediaSourceId();
			if (!id) {
				return () => {
					/* no-op */
				};
			}

			let isCleanedUp = false;

			// Register a Tauri listener for each event name that the shared hook
			// understands. We fan-out to the unified `handler(event, data)` callback
			// after filtering by `mediaSourceId` / `sourceId` relevance.
			const EVENT_NAMES = [
				"media-added",
				"media-deleted",
				"media-changed",
				"media-copied",
				"media-moved",
				"thumbnail-generated",
				"all-jobs-completed",
				"watcher-error",
				"job-progress",
			] as const;

			type EventPayload = {
				mediaSourceId?: string;
				sourceId?: string;
				targetId?: string;
				jobId?: string;
			};

			const unlistenPromises = EVENT_NAMES.map((eventName) =>
				listen<EventPayload>(eventName, (event) => {
					if (isCleanedUp) return;

					const payload = event.payload;
					// Route to handler only if the event is relevant for this source.
					// media-copied and media-moved may target either side of the operation.
					const relevant =
						payload?.mediaSourceId === id ||
						payload?.sourceId === id ||
						payload?.targetId === id ||
						// job-progress is scoped by jobId which may equal the sourceId
						payload?.jobId === id ||
						// Fall back to delivering the event unfiltered when no source key present
						(payload?.mediaSourceId === undefined &&
							payload?.sourceId === undefined &&
							payload?.targetId === undefined &&
							payload?.jobId === undefined);

					if (relevant) {
						handler(eventName, payload);
					}
				}),
			);

			return () => {
				isCleanedUp = true;
				void Promise.all(unlistenPromises).then((unlistenFns) => {
					for (const unlisten of unlistenFns) {
						unlisten();
					}
				});
			};
		},
	};

	useMediaSourceEventsShared({
		...options,
		transport,
	});
}
