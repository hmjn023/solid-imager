import type {
	AllJobsCompletedEvent,
	MediaAddedEvent,
	MediaChangedEvent,
	MediaCopiedEvent,
	MediaDeletedEvent,
	MediaMovedEvent,
	ThumbnailGeneratedEvent,
	WatcherErrorEvent,
} from "@solid-imager/core/domain/events/media-source-events";
import {
	isValidAllJobsCompleted,
	isValidMediaAdded,
	isValidMediaChanged,
	isValidMediaCopied,
	isValidMediaDeleted,
	isValidMediaMoved,
	isValidThumbnailGenerated,
	isValidWatcherError,
} from "@solid-imager/core/domain/events/media-source-events";
import { type Accessor, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

type TypeGuard<T> = (data: unknown) => data is T;

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
	options: MediaSourceEventsOptions = {},
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

		const validateAndDispatch = <T>(
			guard: TypeGuard<T>,
			rawData: unknown,
			callback?: (data: T) => void,
			eventName?: string,
		) => {
			if (guard(rawData)) {
				callback?.(rawData);
			} else {
				logger.warn(
					{ event: eventName, data: rawData },
					"Received invalid event data",
				);
			}
		};

		const handleEvent = (event: string, data: unknown) => {
			switch (event) {
				case "media-added":
					validateAndDispatch(
						isValidMediaAdded,
						data,
						options.onMediaAdded,
						event,
					);
					break;
				case "media-deleted":
					validateAndDispatch(
						isValidMediaDeleted,
						data,
						options.onMediaDeleted,
						event,
					);
					break;
				case "media-changed":
					validateAndDispatch(
						isValidMediaChanged,
						data,
						options.onMediaChanged,
						event,
					);
					break;
				case "media-copied":
					validateAndDispatch(
						isValidMediaCopied,
						data,
						options.onMediaCopied,
						event,
					);
					break;
				case "media-moved":
					validateAndDispatch(
						isValidMediaMoved,
						data,
						options.onMediaMoved,
						event,
					);
					break;
				case "thumbnail-generated":
					validateAndDispatch(
						isValidThumbnailGenerated,
						data,
						options.onThumbnailGenerated,
						event,
					);
					break;
				case "all-jobs-completed":
					validateAndDispatch(
						isValidAllJobsCompleted,
						data,
						options.onAllJobsCompleted,
						event,
					);
					break;
				case "watcher-error":
					validateAndDispatch(
						isValidWatcherError,
						data,
						options.onWatcherError,
						event,
					);
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
