import type {
	JobEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/events";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { subscribeToEventStream } from "../event-stream";
import type {
	ManagerJobHandlers,
	UseBatchJobEventsOptions,
} from "./batch-job-events.types";

export type JobEventStreamFactory = (
	signal: AbortSignal,
) => Promise<AsyncIterable<JobEvent>>;

const BUFFERED_JOB_EVENT_LIMIT = 20;

function assertNever(value: never): never {
	throw new Error(`Unhandled job event: ${String(value)}`);
}

export function shouldSubscribeToJobEvents(
	activeJobId: Accessor<string | null>,
	options: UseBatchJobEventsOptions,
): boolean {
	return options.subscribeImmediately === true || activeJobId() !== null;
}

/** Dispatches events for the active job only; retry events do not invoke a handler. */
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
		case "job-cancellation-requested":
		case "job-retried":
			break;
		case "job-completed":
			handlers.handleJobCompleted(event.data);
			break;
		case "job-failed":
			handlers.handleJobFailed(event.data);
			break;
		case "job-cancelled":
			handlers.handleJobCancelled?.();
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

/**
 * Subscribes to batch events and dispatches those for the active job. Immediate
 * subscriptions buffer the latest event per job until its ID is known. The
 * subscription is disposed with its Solid owner.
 *
 * @param activeJobId - Reactive ID used to filter and replay events.
 * @param handlers - Callbacks for progress and terminal events.
 * @param openStream - Opens the abortable job event stream.
 * @param options - Controls early subscription and connection notification.
 */
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

		const cleanup = subscribeToEventStream(
			openStream,
			(event) => {
				options.onEvent?.(event);
				const jobId = activeJobId();
				if (event.data.jobId === jobId) {
					dispatchJobEvent(jobId, event, handlers);
					return;
				}
				if (options.subscribeImmediately) {
					rememberJobEvent(bufferedEvents, event);
				}
			},
			undefined,
			options.onConnected,
		);

		onCleanup(cleanup);
	});
}

export type { JobFailedEvent, JobProgressEvent };
