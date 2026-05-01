import { PendingDownloadsIndicator as SharedPendingDownloadsIndicator } from "@solid-imager/ui/pending-downloads-indicator";
import { listen } from "@tauri-apps/api/event";
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
			subscribeImportEvents={async (handler) => {
				const callbacks = await Promise.all([
					listen(
						"import-request:created",
						(event) => void handler(event.event, event.payload),
					),
					listen(
						"import-request:processed",
						(event) => void handler(event.event, event.payload),
					),
					listen(
						"import-request:deleted",
						(event) => void handler(event.event, event.payload),
					),
				]);

				return () => {
					for (const callback of callbacks) {
						callback();
					}
				};
			}}
		/>
	);
}
