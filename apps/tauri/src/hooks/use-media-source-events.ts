import {
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
import type { Accessor } from "solid-js";
import { orpc as rawOrpc } from "~/infrastructure/api-clients/orpc-client";

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

const MAX_RETRY_DELAY = 30_000;
const INITIAL_RETRY_DELAY = 1_000;

/**
 * oRPC client with events subscription support.
 * The contract doesn't include `events` (it's an async generator subscription),
 * so we cast to access the router's events method directly.
 */
const orpc = rawOrpc as unknown as {
	sources: {
		events: (
			input: { id: string },
			opts?: { signal?: AbortSignal },
		) => Promise<AsyncIterable<{ event: string; data: unknown }>>;
	};
};

export function createOrpcTransport(
	mediaSourceId: Accessor<string | undefined>,
): MediaSourceEventTransport {
	return {
		listen(handler) {
			const ac = new AbortController();

			const startListening = async () => {
				const id = mediaSourceId();
				if (!id) {
					return;
				}

				let retryCount = 0;

				while (!ac.signal.aborted) {
					try {
						const events = await orpc.sources.events(
							{ id },
							{ signal: ac.signal },
						);

						retryCount = 0;

						for await (const msg of events) {
							if (ac.signal.aborted) {
								break;
							}

							if (msg.event === "connected") {
								continue;
							}

							handler(msg.event, msg.data);
						}
					} catch (err) {
						if (ac.signal.aborted) {
							break;
						}

						retryCount++;
						const delay = Math.min(
							INITIAL_RETRY_DELAY * 2 ** (retryCount - 1),
							MAX_RETRY_DELAY,
						);
						await new Promise<void>((resolve) => {
							const timer = setTimeout(resolve, delay);
							ac.signal.addEventListener(
								"abort",
								() => {
									clearTimeout(timer);
									resolve();
								},
								{ once: true },
							);
						});
					}
				}
			};

			startListening();

			return () => {
				ac.abort();
			};
		},
	};
}

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport = createOrpcTransport(mediaSourceId);

	useMediaSourceEventsShared({
		...options,
		transport,
	});
}

export const createTauriTransport = createOrpcTransport;
