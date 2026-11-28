import type { JobEvent } from "@solid-imager/core/events";
import { createEffect, type Accessor } from "solid-js";
import { isServer } from "@solidjs/web";
import { subscribeToEventStream } from "../event-stream";

/** Opens an abortable stream of job events. */
export type JobEventStreamFactory = (
	signal: AbortSignal,
) => Promise<AsyncIterable<JobEvent>>;

/**
 * Subscribes while enabled on the client and releases the stream on cleanup or when disabled.
 *
 * @param openStream - Opens the stream with an abort signal.
 * @param onEvent - Receives each event from the reconnecting stream.
 * @param enabled - Reactive subscription switch; defaults to enabled.
 */
export function useJobEvents(
	openStream: JobEventStreamFactory,
	onEvent: (event: JobEvent) => void,
	enabled: Accessor<boolean> = () => true,
): void {
	createEffect(
		() => !isServer && enabled(),
		(active) => {
			if (active) return subscribeToEventStream(openStream, onEvent);
		},
	);
}
