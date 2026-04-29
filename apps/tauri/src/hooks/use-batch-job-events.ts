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
import { listen } from "@tauri-apps/api/event";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";

type SafeParseSchema<T> = {
	safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: unknown };
};

function parseEventPayload<T>(schema: SafeParseSchema<T>, payload: unknown): T | null {
	const result = schema.safeParse(payload);
	if (!result.success) {
		console.error("Failed to parse event payload:", result.error);
		return null;
	}
	return result.data;
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

		const unlistenPromises = [
			listen("job-progress", (event) => {
				const data = parseEventPayload<JobProgressEvent>(jobProgressEventSchema, event.payload);
				if (data?.jobId === jobId) {
					handlers.handleJobProgress(data);
				}
			}),
			listen("job-completed", (event) => {
				const data = parseEventPayload<JobCompletedEvent>(jobCompletedEventSchema, event.payload);
				if (data?.jobId === jobId) {
					handlers.handleJobCompleted(data);
				}
			}),
			listen("job-failed", (event) => {
				const data = parseEventPayload<JobFailedEvent>(jobFailedEventSchema, event.payload);
				if (data?.jobId === jobId) {
					handlers.handleJobFailed(data);
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
