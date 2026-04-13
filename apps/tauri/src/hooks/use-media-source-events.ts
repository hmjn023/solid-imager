import {
	type AllJobsCompletedEvent,
	allJobsCompletedEventSchema,
	type MediaAddedEvent,
	mediaAddedEventSchema,
	type MediaChangedEvent,
	mediaChangedEventSchema,
	type MediaCopiedEvent,
	mediaCopiedEventSchema,
	type MediaDeletedEvent,
	mediaDeletedEventSchema,
	type MediaMovedEvent,
	mediaMovedEventSchema,
	type ThumbnailGeneratedEvent,
	thumbnailGeneratedEventSchema,
	type WatcherErrorEvent,
	watcherErrorEventSchema,
} from "@solid-imager/core/domain/sources/events";
import { listen } from "@tauri-apps/api/event";
import { type Accessor, createEffect, onCleanup } from "solid-js";

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
	safeParse: (
		input: unknown,
	) => { success: true; data: T } | { success: false; error: unknown };
};

function parseEventPayload<T>(schema: SafeParseSchema<T>, payload: unknown): T | null {
	const result = schema.safeParse(payload);
	return result.success ? result.data : null;
}

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
) {
	createEffect(() => {
		const id = mediaSourceId();
		const isEnabled =
			typeof options.enabled === "function"
				? options.enabled()
				: (options.enabled ?? true);
		if (!(id && isEnabled)) {
			return;
		}

		const unlistenPromises = [
			listen("media-added", (event) => {
				const payload = parseEventPayload(mediaAddedEventSchema, event.payload);
				if (payload && payload.mediaSourceId === id) {
					options.onMediaAdded?.(payload);
				}
			}),
			listen("media-deleted", (event) => {
				const payload = parseEventPayload(mediaDeletedEventSchema, event.payload);
				if (payload && payload.mediaSourceId === id) {
					options.onMediaDeleted?.(payload);
				}
			}),
			listen("media-changed", (event) => {
				const payload = parseEventPayload(mediaChangedEventSchema, event.payload);
				if (payload && payload.mediaSourceId === id) {
					options.onMediaChanged?.(payload);
				}
			}),
			listen("media-copied", (event) => {
				const payload = parseEventPayload(mediaCopiedEventSchema, event.payload);
				if (
					payload &&
					(payload.sourceId === id || payload.targetId === id)
				) {
					options.onMediaCopied?.(payload);
				}
			}),
			listen("media-moved", (event) => {
				const payload = parseEventPayload(mediaMovedEventSchema, event.payload);
				if (
					payload &&
					(payload.sourceId === id || payload.targetId === id)
				) {
					options.onMediaMoved?.(payload);
				}
			}),
			listen("thumbnail-generated", (event) => {
				const payload = parseEventPayload(
					thumbnailGeneratedEventSchema,
					event.payload,
				);
				if (payload && payload.mediaSourceId === id) {
					options.onThumbnailGenerated?.(payload);
				}
			}),
			listen("all-jobs-completed", (event) => {
				const payload = parseEventPayload(
					allJobsCompletedEventSchema,
					event.payload,
				);
				if (payload && payload.mediaSourceId === id) {
					options.onAllJobsCompleted?.(payload);
				}
			}),
			listen("watcher-error", (event) => {
				const payload = parseEventPayload(watcherErrorEventSchema, event.payload);
				if (payload && payload.mediaSourceId === id) {
					options.onWatcherError?.(payload);
				}
			}),
		];

		onCleanup(() => {
			void Promise.all(unlistenPromises).then((unlistenFns) => {
				for (const unlisten of unlistenFns) {
					unlisten();
				}
			});
		});
	});
}
