import { PendingDownloadsIndicator as SharedPendingDownloadsIndicator } from "@solid-imager/ui/pending-downloads-indicator";
import {
	cancelPendingImports,
	listPendingImports,
	processPendingImports,
} from "~/infrastructure/api-clients/imports-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

export function PendingDownloadsIndicator() {
	return (
		<SharedPendingDownloadsIndicator
			cancelPending={cancelPendingImports}
			listPending={listPendingImports}
			listSources={fetchMediaSources}
			processPending={(jobIds, targetSourceId) =>
				processPendingImports(jobIds, targetSourceId)
			}
			subscribeImportEvents={(_handler) => {
				// No-op for remote server mode - events come from SSE
				return () => {};
			}}
		/>
	);
}
