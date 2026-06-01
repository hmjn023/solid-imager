import {
	type AllJobsCompletedEvent,
	allJobsCompletedEventSchema,
	type JobProgressEvent,
	jobProgressEventSchema,
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
};

/**
 * Transport adapter interface. Implementations bridge the shared hook to a
 * concrete event source (oRPC SSE for server, Tauri event bus for desktop).
 *
 * `listen` must call `handler` with the event name and raw payload for every
 * incoming event and return a cleanup function that cancels the subscription.
 */
export type MediaSourceEventTransport = {
	listen(handler: (event: string, data: unknown) => void): () => void;
};

export type UseMediaSourceEventsOptions = {
	transport: MediaSourceEventTransport;
	enabled?: boolean | Accessor<boolean>;
	onMediaAdded?: (data: MediaAddedEvent) => void;
	onMediaDeleted?: (data: MediaDeletedEvent) => void;
	onMediaChanged?: (data: MediaChangedEvent) => void;
	onMediaCopied?: (data: MediaCopiedEvent) => void;
	onMediaMoved?: (data: MediaMovedEvent) => void;
	onThumbnailGenerated?: (data: ThumbnailGeneratedEvent) => void;
	onAllJobsCompleted?: (data: AllJobsCompletedEvent) => void;
	onWatcherError?: (data: WatcherErrorEvent) => void;
	/** Tauri-only in practice, but included in the shared interface. */
	onJobProgress?: (data: JobProgressEvent) => void;
};

type SafeParseSchema<T> = {
	safeParse: (
		input: unknown,
	) => { success: true; data: T } | { success: false; error: unknown };
};

function validateAndDispatch<T>(
	schema: SafeParseSchema<T>,
	rawData: unknown,
	callback: ((data: T) => void) | undefined,
	eventName: string,
): void {
	if (!callback) {
		return;
	}
	const result = schema.safeParse(rawData);
	if (result.success) {
		callback(result.data);
	} else {
		console.warn(
			`[useMediaSourceEvents] Received invalid data for event "${eventName}":`,
			result.error,
		);
	}
}

/**
 * Shared hook that dispatches media-source events to caller-provided callbacks.
 *
 * Event delivery is decoupled from the transport via `MediaSourceEventTransport`,
 * allowing the same hook to work with oRPC SSE (server) and the Tauri event bus
 * (desktop) without any conditional logic inside the hook itself.
 */
export function useMediaSourceEvents(
	options: UseMediaSourceEventsOptions,
): void {
	createEffect(() => {
		if (isServer) {
			return;
		}

		const isEnabled =
			typeof options.enabled === "function"
				? options.enabled()
				: (options.enabled ?? true);

		if (!isEnabled) {
			return;
		}

		const cleanup = options.transport.listen((event, data) => {
			switch (event) {
				case "media-added":
					validateAndDispatch(
						mediaAddedEventSchema,
						data,
						options.onMediaAdded,
						event,
					);
					break;
				case "media-deleted":
					validateAndDispatch(
						mediaDeletedEventSchema,
						data,
						options.onMediaDeleted,
						event,
					);
					break;
				case "media-changed":
					validateAndDispatch(
						mediaChangedEventSchema,
						data,
						options.onMediaChanged,
						event,
					);
					break;
				case "media-copied":
					validateAndDispatch(
						mediaCopiedEventSchema,
						data,
						options.onMediaCopied,
						event,
					);
					break;
				case "media-moved":
					validateAndDispatch(
						mediaMovedEventSchema,
						data,
						options.onMediaMoved,
						event,
					);
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
					validateAndDispatch(
						allJobsCompletedEventSchema,
						data,
						options.onAllJobsCompleted,
						event,
					);
					break;
				case "watcher-error":
					validateAndDispatch(
						watcherErrorEventSchema,
						data,
						options.onWatcherError,
						event,
					);
					break;
				case "job-progress":
					validateAndDispatch(
						jobProgressEventSchema,
						data,
						options.onJobProgress,
						event,
					);
					break;
				case "connected":
					// Connection established — no action needed.
					break;
				default:
					console.debug(
						`[useMediaSourceEvents] Unknown event received: "${event}"`,
						data,
					);
					break;
			}
		});

		onCleanup(cleanup);
	});
}
