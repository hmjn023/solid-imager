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
	signal?: AbortSignal,
) {
	return client.media.search({ sourceId, params }, { signal });
}

export function searchSimilar(
	input: {
		anchorMediaId: string;
		mediaSourceId?: string;
		topK: number;
	},
	signal?: AbortSignal,
) {
	return client.media.searchSimilar(input, { signal });
}
