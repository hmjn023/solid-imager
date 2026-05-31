import { client } from "~/orpc-client";

export function listPendingImports() {
	return client.imports.listPending();
}

export function processPendingImports(jobIds: string[], targetSourceId: string) {
	return client.imports.process({ jobIds, targetSourceId });
}

export function cancelPendingImports(jobIds: string[]) {
	return client.imports.cancel({ jobIds });
}
