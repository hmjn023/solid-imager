import { client } from "~/orpc-client";

export function fetchMediaDetails(sourceId: string, mediaId: string) {
	return client.media.getDetails({ sourceId, mediaId });
}

export function deleteMedia(sourceId: string, mediaId: string) {
	return client.media.delete({ sourceId, mediaId });
}

export function copyMedia(mediaId: string, targetSourceId: string) {
	return client.media.copy({ mediaId, targetSourceId });
}

export function moveMedia(mediaId: string, targetSourceId: string) {
	return client.media.move({ mediaId, targetSourceId });
}

export function syncMediaItems(sourceId: string, mediaIds: string[]) {
	return client.media.sync({ sourceId, mediaIds });
}

export function findDuplicateMedia(mediaSourceId?: string) {
	return client.media.findDuplicates(
		mediaSourceId ? { mediaSourceId } : undefined,
	);
}

export function bulkDeleteMedia(sourceId: string, mediaIds: string[]) {
	return client.media.bulkDelete({ mediaSourceId: sourceId, mediaIds });
}
