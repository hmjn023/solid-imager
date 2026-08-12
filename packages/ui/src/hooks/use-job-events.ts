import type { JobEvent } from "@solid-imager/core/domain/sources/events";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { subscribeToEventStream } from "../event-stream";

export type JobEventStreamFactory = (
	signal: AbortSignal,
) => Promise<AsyncIterable<JobEvent>>;

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
