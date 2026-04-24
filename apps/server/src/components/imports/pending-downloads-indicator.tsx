import { PendingDownloadsIndicator as SharedPendingDownloadsIndicator } from "@solid-imager/ui/pending-downloads-indicator";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export default function PendingDownloadsIndicator() {
	return (
		<SharedPendingDownloadsIndicator
			cancelPending={(jobIds) => orpc.imports.cancel({ jobIds })}
			listPending={() => orpc.imports.listPending()}
			listSources={() => orpc.sources.list()}
			processPending={(jobIds, targetSourceId) =>
				orpc.imports.process({ jobIds, targetSourceId })
			}
			subscribeImportEvents={async (handler) => {
				const abortController = new AbortController();
				void (async () => {
					const stream = await orpc.imports.events(undefined, {
						signal: abortController.signal,
					});
					for await (const message of stream) {
						if (abortController.signal.aborted) {
							break;
						}
						await handler(message.event, message.data);
					}
				})().catch(() => undefined);

				return () => {
					abortController.abort();
				};
			}}
		/>
	);
}
