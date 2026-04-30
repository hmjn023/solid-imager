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
import { parseJsonEventPayload } from "@solid-imager/core/utils/event-parsers";
import type { ManagerJobHandlers } from "@solid-imager/ui/hooks/use-manager-page";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";

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
			const result = parseJsonEventPayload<JobProgressEvent>(
				event.data,
				jobProgressEventSchema,
			);
			if (result.ok && result.data.jobId === jobId) {
				handlers.handleJobProgress(result.data);
			}
		};

		const onCompleted = (event: MessageEvent) => {
			const result = parseJsonEventPayload<JobCompletedEvent>(
				event.data,
				jobCompletedEventSchema,
			);
			if (result.ok && result.data.jobId === jobId) {
				handlers.handleJobCompleted(result.data);
				eventSource.close();
			}
		};

		const onFailed = (event: MessageEvent) => {
			const result = parseJsonEventPayload<JobFailedEvent>(
				event.data,
				jobFailedEventSchema,
			);
			if (result.ok && result.data.jobId === jobId) {
				handlers.handleJobFailed(result.data);
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
