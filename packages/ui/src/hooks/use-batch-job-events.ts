import type {
	JobEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/domain/sources/events";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { subscribeToEventStream } from "../event-stream";
import type { ManagerJobHandlers } from "./use-manager-page";

export type JobEventStreamFactory = (
	signal: AbortSignal,
) => Promise<AsyncIterable<JobEvent>>;

function assertNever(value: never): never {
	throw new Error(`Unhandled job event: ${value}`);
}

export function useBatchJobEvents(
	activeJobId: Accessor<string | null>,
	handlers: ManagerJobHandlers,
	openStream: JobEventStreamFactory,
): void {
	createEffect(() => {
		if (isServer) {
			return;
		}

		const jobId = activeJobId();
		if (!jobId) {
			return;
		}

		const cleanup = subscribeToEventStream(openStream, (event) => {
			if (event.data.jobId === jobId) {
				switch (event.event) {
					case "job-progress":
						handlers.handleJobProgress(event.data);
						break;
					case "job-completed":
						handlers.handleJobCompleted(event.data);
						break;
					case "job-failed":
						handlers.handleJobFailed(event.data);
						break;
					default:
						assertNever(event);
				}
			}
		});

		onCleanup(cleanup);
	});
}

export type { JobFailedEvent, JobProgressEvent };
