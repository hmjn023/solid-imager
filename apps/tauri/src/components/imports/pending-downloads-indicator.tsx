import { subscribeToEventStream } from "@solid-imager/ui/event-stream";
import { PendingDownloadsIndicator as SharedPendingDownloadsIndicator } from "@solid-imager/ui/pending-downloads-indicator";
import {
	cancelPendingImports,
	listPendingImports,
	processPendingImports,
} from "~/infrastructure/api-clients/imports-api";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
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
			subscribeImportEvents={(handler) => {
				return subscribeToEventStream(
					(signal) => orpc.imports.events(undefined, { signal }),
					handler,
				);
			}}
		/>
	);
}
