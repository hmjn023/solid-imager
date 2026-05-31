import { client } from "~/orpc-client";

export function fetchMediaDetails(sourceId: string, mediaId: string) {
	return client.media.getDetails({ sourceId, mediaId });
}

export function searchMedia(
	sourceId: string | null | undefined,
	params: {
		offset?: number;
		limit?: number;
		sort?: "date" | "name" | "size" | "rating" | "viewCount";
		order?: "asc" | "desc";
	},
) {
	return client.media.search({ sourceId, params });
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
