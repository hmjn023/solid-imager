export {
	searchMedia,
	fetchMediaDetails,
	deleteMedia,
	copyMedia,
	moveMedia,
	syncMediaItems,
} from "~/api/media-api";

import { client } from "~/orpc-client";

export function updateMedia(sourceId: string, mediaId: string, data: unknown) {
	return client.media.update({ sourceId, mediaId, data: data as any });
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

export function startDownloadJobs(mediaSourceId: string, items: unknown[]) {
	return client.downloads.start({ mediaSourceId, items: items as any });
}
