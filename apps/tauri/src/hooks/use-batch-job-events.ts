import { createSignal, onCleanup } from "solid-js";

export function useBatchJobEvents() {
	const [activeJobs, setActiveJobs] = createSignal<
		{ id: string; type: string; progress: number; total: number }[]
	>([]);

	// No-op for remote server mode - events come from SSE
	return { activeJobs };
}
