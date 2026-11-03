import { createSharedEventSubscription } from "@solid-imager/ui/event-stream";
import {
	createSourceEventTransport,
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/source-events";
import { type Accessor, mergeProps } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export type {
	AllJobsCompletedEvent,
	JobProgressEvent,
	MediaAddedEvent,
	MediaChangedEvent,
	MediaCopiedEvent,
	MediaDeletedEvent,
	MediaMovedEvent,
	SourceSyncStatusEvent,
	ThumbnailGeneratedEvent,
	WatcherErrorEvent,
} from "@solid-imager/core/events";

type MediaSourceEventsOptions = Omit<UseMediaSourceEventsOptions, "transport">;

export const subscribeAllSourceEvents = createSharedEventSubscription(
	(signal) => orpc.sources.events({ id: "*" }, { signal }),
);

export function createTauriTransport(
	mediaSourceId: Accessor<string | undefined>,
): MediaSourceEventTransport {
	const scoped = createSourceEventTransport(mediaSourceId, (id, signal) =>
		orpc.sources.events({ id }, { signal }),
	);
	return {
		listen: (handler) =>
			mediaSourceId() === "*"
				? subscribeAllSourceEvents(handler)
				: scoped.listen(handler),
	};
}

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport = createTauriTransport(mediaSourceId);

	useMediaSourceEventsShared(mergeProps(options, { transport }));
}
