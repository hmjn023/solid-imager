/**
 * Search API Client
 * Handles media search functionality
 *
 * NOTE: Migrated to use oRPC ✅
 */

import type { MediaSearchRequest } from "@solid-imager/core/domain/media/schemas";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

/**
 * Searches media in a specific source
 * @param sourceId - Media source ID
 * @param params - Search parameters
 * @returns Search results with media array and total count
 */
export function searchMedia(
	sourceId: string | undefined | null,
	params: MediaSearchRequest,
	signal?: AbortSignal,
) {
	return orpc.media.search(
		{
			sourceId,
			params,
		},
		{ signal },
	);
}

export function searchSimilar(
	input: {
		anchorMediaId: string;
		mediaSourceId?: string;
		topK: number;
	},
	signal?: AbortSignal,
) {
	return orpc.media.searchSimilar(input, { signal });
}
