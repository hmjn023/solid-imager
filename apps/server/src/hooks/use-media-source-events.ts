import {
	type AllJobsCompletedEvent,
	allJobsCompletedEventSchema,
	type MediaAddedEvent,
	type MediaChangedEvent,
	type MediaCopiedEvent,
	type MediaDeletedEvent,
	type MediaMovedEvent,
	mediaAddedEventSchema,
	mediaChangedEventSchema,
	mediaCopiedEventSchema,
	mediaDeletedEventSchema,
	mediaMovedEventSchema,
	type ThumbnailGeneratedEvent,
	thumbnailGeneratedEventSchema,
	type WatcherErrorEvent,
	watcherErrorEventSchema,
} from "@solid-imager/core/domain/sources/events";
import { type Accessor, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

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

type SafeParseSchema<T> = {
	safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: unknown };
};

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
			typeof options.enabled === "function" ? options.enabled() : (options.enabled ?? true);

		if (!(id && isEnabled)) {
			return;
		}

		const ac = new AbortController();

		const validateAndDispatch = <T>(
			schema: SafeParseSchema<T>,
			rawData: unknown,
			callback?: (data: T) => void,
			eventName?: string,
		) => {
			const result = schema.safeParse(rawData);
			if (result.success) {
				callback?.(result.data);
				return;
			}

			logger.warn(
				{ event: eventName, error: result.error, data: rawData },
				"Received invalid event data",
			);
		};

		const handleEvent = (event: string, data: unknown) => {
			switch (event) {
				case "media-added":
					validateAndDispatch(mediaAddedEventSchema, data, options.onMediaAdded, event);
					break;
				case "media-deleted":
					validateAndDispatch(mediaDeletedEventSchema, data, options.onMediaDeleted, event);
					break;
				case "media-changed":
					validateAndDispatch(mediaChangedEventSchema, data, options.onMediaChanged, event);
					break;
				case "media-copied":
					validateAndDispatch(mediaCopiedEventSchema, data, options.onMediaCopied, event);
					break;
				case "media-moved":
					validateAndDispatch(mediaMovedEventSchema, data, options.onMediaMoved, event);
					break;
				case "thumbnail-generated":
					validateAndDispatch(
						thumbnailGeneratedEventSchema,
						data,
						options.onThumbnailGenerated,
						event,
					);
					break;
				case "all-jobs-completed":
					validateAndDispatch(allJobsCompletedEventSchema, data, options.onAllJobsCompleted, event);
					break;
				case "watcher-error":
					validateAndDispatch(watcherErrorEventSchema, data, options.onWatcherError, event);
					break;
				case "connected":
					break;
				default:
					logger.debug({ event, data }, "Unknown event received");
			}
		};

		const startEventStream = async () => {
			try {
				const events = await orpc.sources.events({ id }, { signal: ac.signal });

				for await (const msg of events) {
					if (ac.signal.aborted) {
						break;
					}

					handleEvent(msg.event, msg.data);
				}
			} catch (error) {
				if (!ac.signal.aborted) {
					logger.error({ err: error }, "Event stream error");
				}
			}
		};

		void startEventStream();

		onCleanup(() => {
			ac.abort();
		});
	});
}
