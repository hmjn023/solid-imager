import { mediaDetailsSchema } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaApiContract,
	SourcesApiContract,
	UploadMediaRequest,
} from "@solid-imager/core/interfaces/media-manager-client";
import { z } from "zod";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

const syncSourcesResponseSchema = z.object({
	results: z.array(
		z.object({
			id: z.string(),
			success: z.boolean(),
			added: z.number().optional(),
			updated: z.number().optional(),
			deleted: z.number().optional(),
			error: z.string().optional(),
		}),
	),
});

export const serverMediaApiContract: MediaApiContract = {
	searchMedia: (sourceId, params) => orpc.media.search({ sourceId, params }),
	fetchMediaDetails: (sourceId, mediaId) =>
		orpc.media.getDetails({ sourceId, mediaId }),
	uploadMedia: (sourceId, file, options?: UploadMediaRequest) =>
		orpc.media.upload({
			sourceId,
			file,
			filename: options?.filename,
			description: options?.description,
			sourceUrl: options?.sourceUrl,
			overwrite:
				options?.overwrite !== undefined
					? String(options.overwrite)
					: undefined,
			autoIncrement:
				options?.autoIncrement !== undefined
					? String(options.autoIncrement)
					: undefined,
		}),
	updateMedia: (sourceId, mediaId, updates) =>
		orpc.media
			.update({
				sourceId,
				mediaId,
				data: updates,
			})
			.then((result) => mediaDetailsSchema.parse(result)),
	deleteMedia: (sourceId, mediaId) => orpc.media.delete({ sourceId, mediaId }),
	copyMedia: (_sourceId, mediaId, targetSourceId) =>
		orpc.media.copy({ mediaId, targetSourceId }),
	moveMedia: (_sourceId, mediaId, targetSourceId) =>
		orpc.media.move({ mediaId, targetSourceId }),
	syncMediaItems: (sourceId, mediaIds) =>
		orpc.media.sync({ sourceId, mediaIds }),
	startDownloadJobs: (mediaSourceId, items) =>
		orpc.downloads.start({
			mediaSourceId,
			items,
		}),
};

export const serverSourcesApiContract: SourcesApiContract = {
	fetchMediaSources: () => orpc.sources.list(),
	fetchMediaSource: (id) => orpc.sources.get({ id }),
	createMediaSource: (data) => orpc.sources.create(data),
	updateMediaSource: (id, data) => orpc.sources.update({ id, data }),
	deleteMediaSource: (id) => orpc.sources.delete({ id }),
	syncMediaSources: (ids) =>
		orpc.sources
			.sync({ ids })
			.then((result) => syncSourcesResponseSchema.parse(result)),
	async fetchSourceDump(id, mode = "json") {
		const url = `/api/sources/${id}/dump?mode=${mode}`;
		const response = await fetch(url, {
			method: "GET",
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Failed to download dump: ${response.status} ${errorText}`,
			);
		}

		return response.blob();
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
		const url = `/api/sources/${id}/import`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/zip",
			},
			body: file,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to import ZIP: ${response.status} ${errorText}`);
		}

		return response.json();
	},
};
