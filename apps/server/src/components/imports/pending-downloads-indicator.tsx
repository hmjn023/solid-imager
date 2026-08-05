import { subscribeToEventStream } from "@solid-imager/ui/event-stream";
import {
	type ImportEventConnectedHandler,
	type ImportEventHandler,
	type PendingDownloadsIndicatorProps,
	PendingDownloadsIndicator as SharedPendingDownloadsIndicator,
} from "@solid-imager/ui/pending-downloads-indicator";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

type ImportSubscriber = {
	handler: ImportEventHandler;
	onConnected?: ImportEventConnectedHandler;
};

const importSubscribers = new Set<ImportSubscriber>();
let cleanupImportStream: (() => void) | undefined;

function subscribeSharedImportEvents(
	handler: ImportEventHandler,
	onConnected?: ImportEventConnectedHandler,
): () => void {
	const subscriber = { handler, onConnected };
	importSubscribers.add(subscriber);

	if (!cleanupImportStream) {
		cleanupImportStream = subscribeToEventStream(
			(signal) => orpc.imports.events(undefined, { signal }),
			(event) => {
				for (const current of importSubscribers) {
					void current.handler(event);
				}
			},
			undefined,
			async () => {
				for (const current of importSubscribers) {
					await current.onConnected?.();
				}
			},
		);
	}

	return () => {
		importSubscribers.delete(subscriber);
		if (importSubscribers.size === 0) {
			cleanupImportStream?.();
			cleanupImportStream = undefined;
		}
	};
}

export function PendingDownloadsIndicator(
	displayProps: { compact?: boolean; variant?: "default" | "v2" } = {},
) {
	const indicatorProps: PendingDownloadsIndicatorProps = {
		countPending: async () => {
			const result = await orpc.imports.countPending();
			return result.count;
		},
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
		subscribeImportEvents: (handler, onConnected) => {
			return subscribeSharedImportEvents(handler, onConnected);
		},
	};

	return (
		<SharedPendingDownloadsIndicator {...indicatorProps} {...displayProps} />
	);
}
