import type {
	MediaApiContract,
	SyncMediaItemsResponse,
	SourcesApiContract,
	UploadMediaRequest,
} from "@solid-imager/core/interfaces/media-manager-client";
import { processImportItemsToSource } from "./imports-api";
import { orpc } from "./orpc-client";

function toBooleanString(value: boolean | undefined) {
	return value !== undefined ? String(value) : undefined;
}

export const tauriMediaApiContract: MediaApiContract = {
	searchMedia: (sourceId, params) => orpc.media.search({ sourceId, params }),
	fetchMediaDetails: (sourceId, mediaId) =>
		orpc.media.getDetails({ sourceId, mediaId }),
	async uploadMedia(sourceId, file, options?: UploadMediaRequest) {
		const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
		return orpc.media.upload({
			sourceId,
			bytes,
			filename: options?.filename || file.name,
			description: options?.description,
			sourceUrl: options?.sourceUrl,
			overwrite: toBooleanString(options?.overwrite),
			autoIncrement: toBooleanString(options?.autoIncrement),
		});
	},
	updateMedia: (sourceId, mediaId, updates) =>
		orpc.media.update({
			sourceId,
			mediaId,
			data: updates,
		}),
	deleteMedia: (sourceId, mediaId) => orpc.media.delete({ sourceId, mediaId }),
	copyMedia: (_sourceId, mediaId, targetSourceId) =>
		orpc.media.copy({ mediaId, targetSourceId }),
	moveMedia: (_sourceId, mediaId, targetSourceId) =>
		orpc.media.move({ mediaId, targetSourceId }),
	async syncMediaItems(sourceId, mediaIds) {
		const syncResult = await orpc.sources.sync({ ids: [sourceId] });
		const sourceResult = syncResult.results.find((item) => item.id === sourceId);

		const response: SyncMediaItemsResponse = {
			results: mediaIds.map((id) => ({
				id,
				success: sourceResult?.success ?? true,
				error: sourceResult?.error,
			})),
		};
		return response;
	},
	async startDownloadJobs(mediaSourceId, items) {
		const result = await processImportItemsToSource(mediaSourceId, items);
		return {
			success: true,
			jobCount: result.processedCount,
			message: `Started ${result.processedCount} download jobs`,
		};
	},
};

export const tauriSourcesApiContract: SourcesApiContract = {
	fetchMediaSources: () => orpc.sources.list(),
	fetchMediaSource: (id) => orpc.sources.get({ id }),
	createMediaSource: (data) => orpc.sources.create(data),
	updateMediaSource: (id, data) => orpc.sources.update({ id, data }),
	deleteMediaSource: (id) => orpc.sources.delete({ id }),
	syncMediaSources: (ids) => orpc.sources.sync({ ids }),
	async fetchSourceDump(id, mode = "json") {
		if (mode === "zip") {
			const result = await orpc.sources.dumpZip({ id });
			return new Blob([new Uint8Array(result.data)], {
				type: result.mimeType,
			});
		}
		const data = await orpc.sources.dump({ id });
		return new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
	},
	restoreSource: (id, data) => {
		const payload = data as
			| {
					media?: unknown[];
			  }
			| unknown[];
		const items = Array.isArray(payload)
			? payload
			: Array.isArray(payload.media)
				? payload.media
				: [];
		return orpc.sources.restore({ id, data: items });
	},
	async importSourceZip(id, file) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		return orpc.sources.importZip({ id, bytes: Array.from(bytes) });
	},
};
