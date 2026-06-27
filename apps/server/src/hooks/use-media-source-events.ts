import {
	createSourceEventTransport,
	type MediaSourceEventTransport,
	type UseMediaSourceEventsOptions,
	useMediaSourceEvents as useMediaSourceEventsShared,
} from "@solid-imager/ui/hooks/use-media-source-events";
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

export function createServerTransport(
	mediaSourceId: Accessor<string | undefined>,
): MediaSourceEventTransport {
	return createSourceEventTransport(
		mediaSourceId,
		(id, signal) => orpc.sources.events({ id }, { signal }),
		(err, retryCount, delay) => {
			logger.error({ err, retryCount, delay }, "Event stream error, retrying");
		},
	);
}

export function useMediaSourceEvents(
	mediaSourceId: Accessor<string | undefined>,
	options: MediaSourceEventsOptions = {},
): void {
	const transport = createServerTransport(mediaSourceId);

	useMediaSourceEventsShared(mergeProps(options, { transport }));
}
