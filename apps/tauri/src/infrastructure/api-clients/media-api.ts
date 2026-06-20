export {
	bulkDeleteMedia,
	copyMedia,
	deleteMedia,
	fetchMediaDetails,
	findDuplicateMedia,
	moveMedia,
	searchMedia,
	syncMediaItems,
} from "~/api/media-api";

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
	options?: { filename?: string; description?: string; sourceUrl?: string },
) {
	return client.media.upload({
		sourceId,
		file,
		filename: options?.filename,
		description: options?.description,
		sourceUrl: options?.sourceUrl,
	});
}

export function startDownloadJobs(
	mediaSourceId: string,
	items: DownloadItem[],
) {
	return client.downloads.start({ mediaSourceId, items });
}
