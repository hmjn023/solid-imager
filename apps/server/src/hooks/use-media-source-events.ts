import {
	createSourceEventTransport,
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
import { useLocation } from "@tanstack/solid-router";
import { type Accessor, mergeProps } from "solid-js";
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

type SourceEventHandler = Parameters<MediaSourceEventTransport["listen"]>[0];

type SharedSourceTransport = {
	cleanup: () => void;
	handlers: Set<SourceEventHandler>;
	idleTimer: ReturnType<typeof setTimeout> | null;
	idleSince: number | null;
};

const SOURCE_TRANSPORT_IDLE_TIMEOUT_MS = 30_000;
const MAX_IDLE_SOURCE_TRANSPORTS = 2;

type SourceTransportGlobal = typeof globalThis & {
	__solidImagerSharedSourceTransports?: Map<string, SharedSourceTransport>;
};

const sourceTransportGlobal = globalThis as SourceTransportGlobal;
const sharedSourceTransports =
	sourceTransportGlobal.__solidImagerSharedSourceTransports ??
	new Map<string, SharedSourceTransport>();
sourceTransportGlobal.__solidImagerSharedSourceTransports =
	sharedSourceTransports;

function evictOldestIdleSourceTransport(): void {
	let oldest: { id: string; transport: SharedSourceTransport } | undefined;
	for (const [id, transport] of sharedSourceTransports) {
		const idleSince = transport.idleSince;
		if (
			idleSince !== null &&
			(!oldest ||
				oldest.transport.idleSince === null ||
				idleSince < oldest.transport.idleSince)
		) {
			oldest = { id, transport };
		}
	}
	if (!oldest) {
		return;
	}
	if (oldest.transport.idleTimer) {
		clearTimeout(oldest.transport.idleTimer);
	}
	oldest.transport.cleanup();
	sharedSourceTransports.delete(oldest.id);
}

export function createServerTransport(
	mediaSourceId: Accessor<string | undefined>,
): MediaSourceEventTransport {
	const location = useLocation();
	const isActiveRoute = () => {
		const id = mediaSourceId();
		const pathname = location().pathname;
		if (!id) {
			return false;
		}
		if (id === "*") {
			return pathname === "/search";
		}
		return (
			pathname === `/sources/${id}` || pathname.startsWith(`/sources/${id}/`)
		);
	};

	return {
		listen(handler) {
			const id = mediaSourceId();
			if (!id || !isActiveRoute()) {
				return () => {
					/* no-op */
				};
			}

			let shared = sharedSourceTransports.get(id);
			if (!shared) {
				while (
					[...sharedSourceTransports.values()].filter(
						(transport) => transport.idleSince !== null,
					).length >= MAX_IDLE_SOURCE_TRANSPORTS
				) {
					evictOldestIdleSourceTransport();
				}
				const handlers = new Set<SourceEventHandler>();
				const transport = createSourceEventTransport(
					() => id,
					(sourceId, signal) =>
						orpc.sources.events({ id: sourceId }, { signal }),
					(err, retryCount, delay) => {
						logger.error(
							{ err, retryCount, delay },
							"Event stream error, retrying",
						);
					},
				);
				shared = {
					handlers,
					idleTimer: null,
					cleanup: transport.listen((event) => {
						for (const listener of handlers) {
							try {
								listener(event);
							} catch (err) {
								logger.error({ err }, "Source event listener failed");
							}
						}
					}),
					idleSince: null,
				};
				sharedSourceTransports.set(id, shared);
			}

			if (shared.idleTimer) {
				clearTimeout(shared.idleTimer);
				shared.idleTimer = null;
			}
			shared.idleSince = null;
			shared.handlers.add(handler);
			let isListening = true;
			return () => {
				if (!isListening) {
					return;
				}
				isListening = false;
				shared.handlers.delete(handler);
				if (shared.handlers.size === 0) {
					shared.idleSince = Date.now();
					shared.idleTimer = setTimeout(() => {
						if (shared.handlers.size === 0) {
							shared.cleanup();
							sharedSourceTransports.delete(id);
							shared.idleSince = null;
						}
					}, SOURCE_TRANSPORT_IDLE_TIMEOUT_MS);
				}
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
