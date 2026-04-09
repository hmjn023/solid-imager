import { orpc } from "./orpc-client";
import { searchMedia } from "./search-api";

export async function fetchMediaList(sourceId: string) {
	const result = await orpc.media.search({
		sourceId,
		params: {
			offset: 0,
			limit: 100,
			order: "desc",
		},
	});
	return result.media;
}

export function fetchMediaListInfinite(
	sourceId: string,
	pageParam = 0,
	limit = 50,
) {
	return searchMedia(sourceId, {
		offset: pageParam,
		limit,
		sort: "date",
		order: "desc",
	});
}

export function fetchMediaDetails(sourceId: string, mediaId: string) {
	return orpc.media.getDetails({ sourceId, mediaId });
}

export function updateMedia(
	sourceId: string,
	mediaId: string,
	updates: { description?: string | null; sourceUrls?: string[] },
) {
	return orpc.media.update({
		sourceId,
		mediaId,
		data: updates,
	});
}
