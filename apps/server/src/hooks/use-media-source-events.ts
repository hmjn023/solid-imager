import { type Accessor, createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { z } from "zod";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

// Zod schemas kept for type inference (used via z.infer<>)
export const MediaAddedEventSchema = z.object({
	filePath: z.string(),
	mediaId: z.string().optional(),
	timestamp: z.string().optional(),
});
export type MediaAddedEvent = z.infer<typeof MediaAddedEventSchema>;

export const MediaDeletedEventSchema = z.object({
	filePath: z.string(),
	timestamp: z.string().optional(),
});
export type MediaDeletedEvent = z.infer<typeof MediaDeletedEventSchema>;

export const MediaChangedEventSchema = z.object({
	filePath: z.string(),
	mediaId: z.string().optional(),
	timestamp: z.string().optional(),
});
export type MediaChangedEvent = z.infer<typeof MediaChangedEventSchema>;

export const MediaCopiedEventSchema = z.object({
	sourceId: z.string(),
	media: z.unknown(),
	timestamp: z.string(),
});
export type MediaCopiedEvent = z.infer<typeof MediaCopiedEventSchema>;

export const MediaMovedEventSchema = z.object({
	type: z.enum(["source", "target"]),
	mediaId: z.string().optional(),
	targetId: z.string().optional(),
	media: z.unknown().optional(),
	sourceId: z.string().optional(),
	timestamp: z.string(),
});
export type MediaMovedEvent = z.infer<typeof MediaMovedEventSchema>;

export const ThumbnailGeneratedEventSchema = z.object({
	mediaId: z.string(),
});
export type ThumbnailGeneratedEvent = z.infer<
	typeof ThumbnailGeneratedEventSchema
>;

export const AllJobsCompletedEventSchema = z.object({
	processed: z.number(),
});
export type AllJobsCompletedEvent = z.infer<typeof AllJobsCompletedEventSchema>;

export const WatcherErrorEventSchema = z.object({
	error: z.string().optional(),
});
export type WatcherErrorEvent = z.infer<typeof WatcherErrorEventSchema>;

// ── Fast type guards (avoid Zod safeParse overhead in hot SSE loop) ──

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidMediaAdded(data: unknown): data is MediaAddedEvent {
	return isRecord(data) && typeof data.filePath === "string";
}

function isValidMediaDeleted(data: unknown): data is MediaDeletedEvent {
	return isRecord(data) && typeof data.filePath === "string";
}

function isValidMediaChanged(data: unknown): data is MediaChangedEvent {
	return isRecord(data) && typeof data.filePath === "string";
}

function isValidMediaCopied(data: unknown): data is MediaCopiedEvent {
	return (
		isRecord(data) &&
		typeof data.sourceId === "string" &&
		typeof data.timestamp === "string"
	);
}

function isValidMediaMoved(data: unknown): data is MediaMovedEvent {
	return (
		isRecord(data) &&
		(data.type === "source" || data.type === "target") &&
		typeof data.timestamp === "string"
	);
}

function isValidThumbnailGenerated(
	data: unknown,
): data is ThumbnailGeneratedEvent {
	return isRecord(data) && typeof data.mediaId === "string";
}

function isValidAllJobsCompleted(data: unknown): data is AllJobsCompletedEvent {
	return isRecord(data) && typeof data.processed === "number";
}

function isValidWatcherError(data: unknown): data is WatcherErrorEvent {
	return isRecord(data) && typeof data.error === "string";
}

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
