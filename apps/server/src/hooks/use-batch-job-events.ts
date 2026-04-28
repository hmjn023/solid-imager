import type {
	JobCompletedEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/domain/sources/events";
import {
	jobCompletedEventSchema,
	jobFailedEventSchema,
	jobProgressEventSchema,
} from "@solid-imager/core/domain/sources/events";
import type { ManagerJobHandlers } from "@solid-imager/ui/hooks/use-manager-page";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";

type SafeParseSchema<T> = {
	safeParse: (
		input: unknown,
	) => { success: true; data: T } | { success: false; error: unknown };
};

function parseJsonEventPayload<T>(
	schema: SafeParseSchema<T>,
	event: MessageEvent,
): T | null {
	try {
		const result = schema.safeParse(JSON.parse(event.data));
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export function useBatchJobEvents(
	activeJobId: Accessor<string | null>,
	handlers: ManagerJobHandlers,
) {
	createEffect(() => {
		const jobId = activeJobId();
		if (!jobId) {
			return;
		}

		const eventSource = new EventSource("/api/events");

		const onProgress = (event: MessageEvent) => {
			const data = parseJsonEventPayload<JobProgressEvent>(
				jobProgressEventSchema,
				event,
			);
			if (data?.jobId === jobId) {
				handlers.handleJobProgress(data);
			}
		};

		const onCompleted = (event: MessageEvent) => {
			const data = parseJsonEventPayload<JobCompletedEvent>(
				jobCompletedEventSchema,
				event,
			);
			if (data?.jobId === jobId) {
				handlers.handleJobCompleted(data);
				eventSource.close();
			}
		};

		const onFailed = (event: MessageEvent) => {
			const data = parseJsonEventPayload<JobFailedEvent>(
				jobFailedEventSchema,
				event,
			);
			if (data?.jobId === jobId) {
				handlers.handleJobFailed(data);
				eventSource.close();
			}
		};

		eventSource.addEventListener("job-progress", onProgress);
		eventSource.addEventListener("job-completed", onCompleted);
		eventSource.addEventListener("job-failed", onFailed);

		onCleanup(() => {
			eventSource.removeEventListener("job-progress", onProgress);
			eventSource.removeEventListener("job-completed", onCompleted);
			eventSource.removeEventListener("job-failed", onFailed);
			eventSource.close();
		});
	});
}
