import { createSharedEventSubscription } from "@solid-imager/ui/event-stream";
import type { PendingDownloadsIndicatorProps } from "@solid-imager/ui/pending-downloads-indicator";
import { getApiOrigin, orpc } from "~/infrastructure/api-clients/orpc-client";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

export const subscribeImportEvents = createSharedEventSubscription((signal) =>
	orpc.imports.events(undefined, { signal }),
);

export const pendingDownloadsIndicatorProps: PendingDownloadsIndicatorProps = {
	danbooruPreview: {
		apiBase: getApiOrigin,
		loadPost: (id) => orpc.danbooru.getPost({ id }),
	},
	pixivPreview: {
		apiBase: getApiOrigin,
		loadPoster: async (id) =>
			(await orpc.viewer.pixivArtwork({ id })).pages[0]?.preview,
	},
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
	subscribeImportEvents,
};
