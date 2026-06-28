import {
	type AllJobsCompletedEvent,
	allJobsCompletedEventSchema,
	type DownloadErrorEvent,
	downloadErrorEventSchema,
	type JobProgressEvent,
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
	type SourceEvent,
	type ThumbnailGeneratedEvent,
	thumbnailGeneratedEventSchema,
	type WatcherErrorEvent,
	watcherErrorEventSchema,
} from "@solid-imager/core/domain/sources/events";
import { type Accessor, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { subscribeToEventStream } from "../event-stream";

export type {
	AllJobsCompletedEvent,
	DownloadErrorEvent,
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
 * concrete typed oRPC event stream.
 *
 * `listen` must call `handler` with a validated source event and return a
 * cleanup function that cancels the subscription.
 */
export type MediaSourceEventTransport = {
	listen(handler: (event: SourceEvent) => void): () => void;
};

export type SourceEventStreamFactory = (
	mediaSourceId: string,
	signal: AbortSignal,
) => Promise<AsyncIterable<SourceEvent>>;

export function createSourceEventTransport(
	mediaSourceId: Accessor<string | undefined>,
	openStream: SourceEventStreamFactory,
	onError?: (error: unknown, retryCount: number, delay: number) => void,
): MediaSourceEventTransport {
	return {
		listen(handler) {
			const id = mediaSourceId();
			if (!id) {
				return () => {
					/* no-op */
				};
			}

			return subscribeToEventStream(
				(signal) => openStream(id, signal),
				handler,
				onError,
			);
		},
	};
}

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
	onDownloadError?: (data: DownloadErrorEvent) => void;
};

type SafeParseSchema<T> = {
	safeParse: (
		input: unknown,
	) => { success: true; data: T } | { success: false; error: unknown };
};

function assertNever(value: never): never {
	throw new Error(`Unhandled source event: ${value}`);
}

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
 * allowing the same hook to work in the server and Tauri clients without
 * transport-specific logic.
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

		const cleanup = options.transport.listen((message) => {
			const { event, data } = message;
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
				case "download-error":
					validateAndDispatch(
						downloadErrorEventSchema,
						data,
						options.onDownloadError,
						event,
					);
					break;
				default:
					assertNever(event);
			}
		});

		onCleanup(cleanup);
	});
}
