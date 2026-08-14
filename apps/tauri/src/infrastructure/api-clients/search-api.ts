import type { MediaSearchRequest } from "@solid-imager/core/domain/media/schemas";
import { client } from "~/orpc-client";

export function searchMedia(
	sourceId: string | null | undefined,
	params: MediaSearchRequest,
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
