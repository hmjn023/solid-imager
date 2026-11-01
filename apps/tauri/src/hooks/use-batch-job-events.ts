import type {
	ManagerJobHandlers,
	UseBatchJobEventsOptions,
} from "@solid-imager/ui/hooks/batch-job-events.types";
import { useBatchJobEvents as useBatchJobEventsShared } from "@solid-imager/ui/hooks/use-batch-job-events";
import type { Accessor } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export function useBatchJobEvents(
	activeJobId: Accessor<string | null>,
	handlers: ManagerJobHandlers,
	options?: UseBatchJobEventsOptions,
) {
	useBatchJobEventsShared(
		activeJobId,
		handlers,
		(signal) => orpc.jobs.events(undefined, { signal }),
		options,
	);
}
