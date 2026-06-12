import {
	type PendingDownloadsIndicatorProps,
	PendingDownloadsIndicator as SharedPendingDownloadsIndicator,
} from "@solid-imager/ui/pending-downloads-indicator";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

export function PendingDownloadsIndicator() {
	const props: PendingDownloadsIndicatorProps = {
		listPending: async () => {
			const jobs = await orpc.imports.listPending();
			return jobs;
		},
		listSources: async () => {
			const sources = await fetchMediaSources();
			return sources.filter((s): s is typeof s & { id: string } => !!s.id);
		},
		processPending: async (jobIds, targetSourceId) => {
			const result = await orpc.imports.process({
				jobIds,
				targetSourceId,
			});
			return {
				success: result.success,
				processedCount: result.processedCount,
			};
		},
		cancelPending: async (jobIds) => {
			const result = await orpc.imports.cancel({ jobIds });
			return { success: result.success };
		},
		subscribeImportEvents: (handler) => {
			const ac = new AbortController();
			let cleanup: (() => void) | undefined;

			void (async () => {
				try {
					const stream = await orpc.imports.events(undefined, {
						signal: ac.signal,
					});
					for await (const msg of stream) {
						if (ac.signal.aborted) break;
						await handler(msg.event, msg);
					}
				} catch {
					// stream ended
				}
			})();

			return () => {
				ac.abort();
				cleanup?.();
			};
		},
	};

	return <SharedPendingDownloadsIndicator {...props} />;
}
