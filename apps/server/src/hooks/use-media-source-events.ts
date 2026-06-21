import {
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
import { type Accessor, mergeProps } from "solid-js";
import { isServer } from "solid-js/web";
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
			const id = mediaSourceId() || "*";
			
			if (isServer) {
				return () => {
					/* no-op */
				};
			}

			const channelName = `solid-imager-sources-events:${id}`;
			const channel = new BroadcastChannel(channelName);
			
			let ac: AbortController | null = null;
			let isListening = false;
			let active = true;

			const startEventStream = async () => {
				if (!active || isListening || document.visibilityState === "hidden") {
					return;
				}
				isListening = true;
				ac = new AbortController();
				const signal = ac.signal;
				let retryCount = 0;

				while (!signal.aborted && active) {
					try {
						const events = await orpc.sources.events(
							{ id: id === "*" ? "*" : id },
							{ signal },
						);

						retryCount = 0;

						for await (const msg of events) {
							if (signal.aborted || !active) {
								break;
							}
							
							// Call handler for current active tab
							handler(msg.event, msg.data);
							
							// Broadcast to other tabs
							channel.postMessage({ event: msg.event, data: msg.data });
						}
					} catch (err) {
						if (signal.aborted || !active) {
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
							const onAbort = () => {
								clearTimeout(timer);
								resolve();
							};
							const timer = setTimeout(() => {
								signal.removeEventListener("abort", onAbort);
								resolve();
							}, delay);
							signal.addEventListener("abort", onAbort, { once: true });
						});
					}
				}
			};

			const stopEventStream = () => {
				if (ac) {
					ac.abort();
					ac = null;
				}
				isListening = false;
			};

			// Broadcast listener for non-active tabs
			channel.onmessage = (e) => {
				if (document.visibilityState === "hidden") {
					const { event, data } = e.data;
					handler(event, data);
				}
			};

			const handleVisibilityChange = () => {
				if (document.visibilityState === "visible") {
					startEventStream();
				} else {
					stopEventStream();
				}
			};

			document.addEventListener("visibilitychange", handleVisibilityChange);
			startEventStream();

			return () => {
				active = false;
				stopEventStream();
				document.removeEventListener("visibilitychange", handleVisibilityChange);
				channel.close();
			};
		},
	};
}

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport = createServerTransport(mediaSourceId);

	useMediaSourceEventsShared(mergeProps(options, { transport }));
}
