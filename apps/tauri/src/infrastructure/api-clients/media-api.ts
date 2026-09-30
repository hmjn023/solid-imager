export {
	bulkCopyToSource,
	bulkDeleteMedia,
	bulkMoveMedia,
	bulkMoveToSource,
	copyMedia,
	deleteMedia,
	fetchMediaDetails,
	findDuplicateMedia,
	moveMedia,
	syncMediaItems,
} from "~/api/media-api";
export { searchMedia } from "./search-api";

import type {
	DownloadItem,
	UpdateMediaRequest,
} from "@solid-imager/core/domain/media/schemas";
import { client } from "~/orpc-client";

export function updateMedia(
	sourceId: string,
	mediaId: string,
	data: UpdateMediaRequest,
) {
	return client.media.update({ sourceId, mediaId, data });
}

export function uploadMedia(
	sourceId: string,
	file: File,
	options?: {
		filename?: string;
		description?: string;
		sourceUrl?: string;
		overwrite?: boolean;
		autoIncrement?: boolean;
	},
) {
	return client.media.upload({
		sourceId,
		file,
		filename: options?.filename,
		description: options?.description,
		sourceUrl: options?.sourceUrl,
		overwrite:
			options?.overwrite !== undefined ? String(options.overwrite) : undefined,
		autoIncrement:
			options?.autoIncrement !== undefined
				? String(options.autoIncrement)
				: undefined,
	});
}

export function startDownloadJobs(
	mediaSourceId: string,
	items: DownloadItem[],
) {
	return client.downloads.start({ mediaSourceId, items });
}
