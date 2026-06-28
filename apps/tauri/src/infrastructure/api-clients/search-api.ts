import { client } from "~/orpc-client";

export function searchMedia(
	sourceId: string | null | undefined,
	params: {
		offset?: number;
		limit?: number;
		sort?: "date" | "name" | "size" | "rating" | "viewCount";
		order?: "asc" | "desc";
		condition?: unknown;
	},
) {
	return client.media.search({ sourceId, params });
}

export function searchSimilar(input: {
	anchorMediaId: string;
	mediaSourceId?: string;
	topK: number;
}) {
	return client.media.searchSimilar(input);
}
