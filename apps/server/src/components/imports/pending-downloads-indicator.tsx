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
			const channelName = "solid-imager-import-events";
			const channel = new BroadcastChannel(channelName);
			
			let ac = new AbortController();
			let active = true;
			let isListening = false;

			const startEventStream = async () => {
				if (!active || isListening || document.visibilityState === "hidden") {
					return;
				}
				isListening = true;
				try {
					const stream = await orpc.imports.events(undefined, {
						signal: ac.signal,
					});
					for await (const msg of stream) {
						if (ac.signal.aborted || !active) break;
						
						// Process locally for the active tab
						await handler(msg.event, msg);
						
						// Broadcast to other tabs
						channel.postMessage(msg);
					}
				} catch {
					// stream ended
				} finally {
					isListening = false;
				}
			};

			const stopEventStream = () => {
				ac.abort();
				ac = new AbortController();
				isListening = false;
			};

			// Process events from active tab when hidden
			channel.onmessage = async (e) => {
				if (document.visibilityState === "hidden") {
					const msg = e.data;
					await handler(msg.event, msg);
				}
			};

			const handleVisibilityChange = () => {
				if (document.visibilityState === "visible") {
					startEventStream();
				} else {
					stopEventStream();
				}
			};

			document.addEventListener("visibilitychange", handleVisibilityChange);
			startEventStream();

			return () => {
				active = false;
				ac.abort();
				document.removeEventListener("visibilitychange", handleVisibilityChange);
				channel.close();
			};
		},
	};

	return <SharedPendingDownloadsIndicator {...props} />;
}
