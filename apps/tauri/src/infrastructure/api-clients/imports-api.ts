import { createSharedEventSubscription } from "@solid-imager/ui/event-stream";
import { client } from "~/orpc-client";

export const subscribeImportEvents = createSharedEventSubscription((signal) =>
	client.imports.events(undefined, { signal }),
);

export function listPendingImports() {
	return client.imports.listPending();
}

export function processPendingImports(
	jobIds: string[],
	targetSourceId: string,
) {
	return client.imports.process({ jobIds, targetSourceId });
}

export function cancelPendingImports(jobIds: string[]) {
	return client.imports.cancel({ jobIds });
}
