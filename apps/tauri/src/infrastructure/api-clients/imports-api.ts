import type { PendingImportJob } from "@solid-imager/ui/import-review-modal";
import { client } from "~/orpc-client";

export function listPendingImports(): Promise<PendingImportJob[]> {
	return client.imports.listPending() as unknown as Promise<PendingImportJob[]>;
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
