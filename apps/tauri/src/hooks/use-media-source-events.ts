import {
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
import { listen } from "@tauri-apps/api/event";
import { type Accessor, mergeProps } from "solid-js";

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

export function createTauriTransport(
	mediaSourceId: Accessor<string | undefined>,
): MediaSourceEventTransport {
	return {
		listen(handler) {
			const id = mediaSourceId();
			if (!id) {
				return () => {
					/* no-op */
				};
			}

			let isCleanedUp = false;

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
					const relevant =
						payload?.mediaSourceId === id ||
						payload?.sourceId === id ||
						payload?.targetId === id ||
						payload?.jobId === id ||
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
				void Promise.allSettled(unlistenPromises).then((results) => {
					for (const result of results) {
						if (result.status === "fulfilled") {
							result.value();
						}
					}
				});
			};
		},
	};
}

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport = createTauriTransport(mediaSourceId);

	useMediaSourceEventsShared(mergeProps(options, { transport }));
}
