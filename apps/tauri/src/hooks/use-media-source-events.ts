import {
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
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

export function createSseTransport(
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

			const eventSource = new EventSource(
				`/api/sources/${id}/events`,
			);

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

			for (const eventName of EVENT_NAMES) {
				eventSource.addEventListener(eventName, (event) => {
					try {
						const data = JSON.parse((event as MessageEvent).data);
						handler(eventName, data);
					} catch {
						// ignore parse errors
					}
				});
			}

			return () => {
				eventSource.close();
			};
		},
	};
}

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport = createSseTransport(mediaSourceId);

	useMediaSourceEventsShared({
		...options,
		transport,
	});
}

export const createTauriTransport = createSseTransport;
