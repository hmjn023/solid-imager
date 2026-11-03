import type { JobEvent } from "@solid-imager/core/domain/sources/events";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
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
	createEffect(() => {
		if (isServer || !enabled()) {
			return;
		}

		const cleanup = subscribeToEventStream(openStream, onEvent);
		onCleanup(cleanup);
	});
}
