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
import { parseEventPayload } from "@solid-imager/core/utils/event-parsers";
import type { ManagerJobHandlers } from "@solid-imager/ui/hooks/use-manager-page";
import { listen } from "@tauri-apps/api/event";
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

		const unlistenPromises = [
			listen("job-progress", (event) => {
				const result = parseEventPayload<JobProgressEvent>(event.payload, jobProgressEventSchema);
				if (result.ok && result.data.jobId === jobId) {
					handlers.handleJobProgress(result.data);
				}
			}),
			listen("job-completed", (event) => {
				const result = parseEventPayload<JobCompletedEvent>(event.payload, jobCompletedEventSchema);
				if (result.ok && result.data.jobId === jobId) {
					handlers.handleJobCompleted(result.data);
				}
			}),
			listen("job-failed", (event) => {
				const result = parseEventPayload<JobFailedEvent>(event.payload, jobFailedEventSchema);
				if (result.ok && result.data.jobId === jobId) {
					handlers.handleJobFailed(result.data);
				}
			}),
		];

		onCleanup(() => {
			for (const promise of unlistenPromises) {
				void promise.then((unlisten) => unlisten()).catch(console.error);
			}
		});
	});
}
