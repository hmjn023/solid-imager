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

export type UseBatchJobEventsOptions = {
	subscribeImmediately?: boolean;
};

const BUFFERED_JOB_EVENT_LIMIT = 20;

function assertNever(value: never): never {
	throw new Error(`Unhandled job event: ${value}`);
}

export function shouldSubscribeToJobEvents(
	activeJobId: Accessor<string | null>,
	options: UseBatchJobEventsOptions,
): boolean {
	return options.subscribeImmediately === true || activeJobId() !== null;
}

export function dispatchJobEvent(
	activeJobId: string | null,
	event: JobEvent,
	handlers: ManagerJobHandlers,
): void {
	if (event.data.jobId !== activeJobId) {
		return;
	}

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

function rememberJobEvent(
	bufferedEvents: Map<string, JobEvent>,
	event: JobEvent,
): void {
	const { jobId } = event.data;
	if (!jobId) {
		return;
	}
	bufferedEvents.set(jobId, event);
	if (bufferedEvents.size <= BUFFERED_JOB_EVENT_LIMIT) {
		return;
	}
	const oldestJobId = bufferedEvents.keys().next().value;
	if (typeof oldestJobId === "string") {
		bufferedEvents.delete(oldestJobId);
	}
}

export function useBatchJobEvents(
	activeJobId: Accessor<string | null>,
	handlers: ManagerJobHandlers,
	openStream: JobEventStreamFactory,
	options: UseBatchJobEventsOptions = {},
): void {
	const bufferedEvents = new Map<string, JobEvent>();

	createEffect(() => {
		const jobId = activeJobId();
		if (!jobId) {
			return;
		}
		const bufferedEvent = bufferedEvents.get(jobId);
		if (!bufferedEvent) {
			return;
		}
		bufferedEvents.delete(jobId);
		dispatchJobEvent(jobId, bufferedEvent, handlers);
	});

	createEffect(() => {
		if (isServer) {
			return;
		}

		if (!shouldSubscribeToJobEvents(activeJobId, options)) {
			return;
		}

		const cleanup = subscribeToEventStream(openStream, (event) => {
			const jobId = activeJobId();
			if (event.data.jobId === jobId) {
				dispatchJobEvent(jobId, event, handlers);
				return;
			}
			if (options.subscribeImmediately) {
				rememberJobEvent(bufferedEvents, event);
			}
		});

		onCleanup(cleanup);
	});
}

export type { JobFailedEvent, JobProgressEvent };
