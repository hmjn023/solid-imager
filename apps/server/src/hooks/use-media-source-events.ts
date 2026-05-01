import {
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
import type { Accessor } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

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

export function createServerTransport(
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

			const ac = new AbortController();

			const startEventStream = async () => {
				try {
					const events = await orpc.sources.events(
						{ id },
						{ signal: ac.signal },
					);

					for await (const msg of events) {
						if (ac.signal.aborted) {
							break;
						}
						handler(msg.event, msg.data);
					}
				} catch (err) {
					if (!ac.signal.aborted) {
						logger.error({ err }, "Event stream error");
					}
				}
			};

			startEventStream();

			return () => {
				ac.abort();
			};
		},
	};
}

/**
 * Server-side thin wrapper around the shared `useMediaSourceEvents` hook.
 *
 * Creates an oRPC SSE transport scoped to `mediaSourceId` and injects it into
 * the shared hook. The `mediaSourceId` accessor is read synchronously inside
 * the transport's `listen` method, which itself is called inside the shared
 * hook's `createEffect`, so changes to `mediaSourceId()` correctly re-trigger
 * the effect, abort the previous SSE connection, and open a new one.
 */
export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport = createServerTransport(mediaSourceId);

	useMediaSourceEventsShared({
		...options,
		transport,
	});
}
