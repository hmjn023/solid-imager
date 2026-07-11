import {
	type UseBatchJobEventsOptions,
	useBatchJobEvents as useBatchJobEventsShared,
} from "@solid-imager/ui/hooks/use-batch-job-events";
import type { ManagerJobHandlers } from "@solid-imager/ui/hooks/use-manager-page";
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
