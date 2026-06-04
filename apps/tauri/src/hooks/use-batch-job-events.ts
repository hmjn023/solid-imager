import type { ManagerJobHandlers } from "@solid-imager/ui/hooks/use-manager-page";
import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
	? window.location.origin
	: import.meta.env.VITE_API_URL || "http://192.168.1.150:3000";

export function useBatchJobEvents(
	activeJobId: Accessor<string | null>,
	handlers: ManagerJobHandlers,
) {
	createEffect(() => {
		const jobId = activeJobId();
		if (!jobId) {
			return;
		}

		const eventSource = new EventSource(`${API_BASE}/api/events`);

		const onProgress = (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data);
				if (data.jobId === jobId) {
					handlers.handleJobProgress(data);
				}
			} catch {
				// ignore parse errors
			}
		};

		const onCompleted = (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data);
				if (data.jobId === jobId) {
					handlers.handleJobCompleted(data);
				}
			} catch {
				// ignore parse errors
			}
		};

		const onFailed = (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data);
				if (data.jobId === jobId) {
					handlers.handleJobFailed(data);
				}
			} catch {
				// ignore parse errors
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
