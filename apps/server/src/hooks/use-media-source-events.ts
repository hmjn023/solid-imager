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

const MAX_RETRY_DELAY = 30_000;
const INITIAL_RETRY_DELAY = 1_000;

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

						logger.error(
							{ err, retryCount, delay },
							"Event stream error, retrying",
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

			startEventStream();

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
	const transport = createServerTransport(mediaSourceId);

	useMediaSourceEventsShared({
		...options,
		transport,
	});
}
