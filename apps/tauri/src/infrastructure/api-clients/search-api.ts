import type { MediaSearchRequest } from "@solid-imager/core/domain/media/schemas";
import type {
	SemanticSearchRequest,
	SimilarityModel,
} from "@solid-imager/core/domain/search/embedding";
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
		model?: SimilarityModel;
		anchorMediaId: string;
		mediaSourceId?: string;
		topK: number;
		limit: number;
		offset: number;
	},
	signal?: AbortSignal,
) {
	return client.media.searchSimilar(input, { signal });
}

export function searchSemantic(
	input: SemanticSearchRequest,
	signal?: AbortSignal,
) {
	return client.media.searchSemantic(input, { signal });
}
