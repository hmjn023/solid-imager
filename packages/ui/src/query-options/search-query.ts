import type {
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import {
	type InfiniteData,
	infiniteQueryOptions,
	keepPreviousData,
} from "@tanstack/solid-query";

export type SearchResultsQueryKeyInput = {
	mode: "simple" | "pro" | "vector";
	sourceId: string | undefined;
	conditionKey: string;
	sort: string | undefined;
	order: "asc" | "desc";
	limit: number;
	similarityAnchorMediaId: string | null;
	similarityTopK: number;
};

export const searchQueryKeys = {
	all: () => ["searchResults"] as const,
	results: (input: SearchResultsQueryKeyInput) =>
		["searchResults", input] as const,
};

export type SourceMediaQueryKeyInput = {
	sourceId: string | undefined;
	conditionKey: string;
	sort: string | undefined;
	order: "asc" | "desc";
	limit: number;
};

export const sourceMediaQueryKeys = {
	all: () => ["media"] as const,
	forSource: (sourceId: string | undefined) => ["media", sourceId] as const,
	results: (input: SourceMediaQueryKeyInput) =>
		["media", input.sourceId, input] as const,
};

export function isSourceMediaResultsQueryKey(
	queryKey: readonly unknown[],
	sourceId: string,
): boolean {
	const [scope, querySourceId, input] = queryKey;
	return (
		scope === "media" &&
		querySourceId === sourceId &&
		typeof input === "object" &&
		input !== null &&
		"conditionKey" in input
	);
}

/**
 * Removes a known-deleted media item from cached infinite result pages.
 *
 * A source event only identifies the deleted record; it does not contain
 * enough data to safely insert or replace records for arbitrary filters and
 * sort orders. Removing an existing item is therefore the only safe local
 * cache update, with a subsequent background refetch reconciling pagination.
 */
export function removeMediaFromInfiniteQueryData(
	data: InfiniteData<MediaSearchResponse> | undefined,
	mediaId: string,
): InfiniteData<MediaSearchResponse> | undefined {
	if (!data) {
		return data;
	}

	let removed = false;
	const pages = data.pages.map((page) => {
		const media = page.media.filter((item) => item.id !== mediaId);
		if (media.length === page.media.length) {
			return page;
		}
		removed = true;
		return { ...page, media };
	});

	if (!removed) {
		return data;
	}

	return {
		...data,
		pages: pages.map((page) => ({
			...page,
			total: Math.max(page.total - 1, 0),
		})),
	};
}

type SearchMedia = (
	sourceId: string | undefined,
	params: MediaSearchRequest,
	signal?: AbortSignal,
) => Promise<MediaSearchResponse>;

type SearchSourceMedia = (
	sourceId: string,
	params: MediaSearchRequest,
	signal?: AbortSignal,
) => Promise<MediaSearchResponse>;

type SearchSimilar = (
	input: {
		anchorMediaId: string;
		mediaSourceId?: string;
		topK: number;
	},
	signal?: AbortSignal,
) => Promise<MediaSearchResponse>;

export type SearchResultsQueryOptionsInput = {
	mode: "simple" | "pro" | "vector";
	sourceId: string | undefined;
	condition: MediaSearchRequest["condition"];
	conditionKey: string;
	sort: MediaSearchRequest["sort"];
	order: "asc" | "desc";
	limit: number;
	similarityAnchorMediaId: string | null;
	similarityTopK: number;
	searchMedia: SearchMedia;
	searchSimilar: SearchSimilar | undefined;
	enabled?: boolean;
	gcTime?: number;
};

export function buildSearchResultsQueryOptions(
	input: SearchResultsQueryOptionsInput,
) {
	return infiniteQueryOptions({
		queryKey: searchQueryKeys.results({
			mode: input.mode,
			sourceId: input.sourceId,
			conditionKey: input.conditionKey,
			sort: input.sort,
			order: input.order,
			limit: input.limit,
			similarityAnchorMediaId: input.similarityAnchorMediaId,
			similarityTopK: input.similarityTopK,
		}),
		queryFn: async ({ pageParam, signal }): Promise<MediaSearchResponse> => {
			if (input.mode === "vector") {
				if (!(input.similarityAnchorMediaId && input.searchSimilar)) {
					return { media: [], total: 0 };
				}
				return await input.searchSimilar(
					{
						anchorMediaId: input.similarityAnchorMediaId,
						mediaSourceId: input.sourceId,
						topK: input.similarityTopK,
					},
					signal,
				);
			}

			return await input.searchMedia(
				input.sourceId,
				{
					condition: input.condition || undefined,
					sort: input.sort,
					order: input.order,
					limit: input.limit,
					offset: typeof pageParam === "number" ? pageParam : 0,
				},
				signal,
			);
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			if (input.mode === "vector") {
				return;
			}
			const loadedCount = allPages.reduce(
				(sum, page) => sum + page.media.length,
				0,
			);
			return loadedCount < lastPage.total ? loadedCount : undefined;
		},
		placeholderData: keepPreviousData,
		enabled: input.enabled,
		gcTime: input.gcTime,
	});
}

export type SourceMediaResultsQueryOptionsInput = {
	sourceId: string | undefined;
	condition: MediaSearchRequest["condition"];
	conditionKey: string;
	sort: MediaSearchRequest["sort"];
	order: "asc" | "desc";
	limit: number;
	searchMedia: SearchSourceMedia;
	enabled?: boolean;
};

export function buildSourceMediaResultsQueryOptions(
	input: SourceMediaResultsQueryOptionsInput,
) {
	return infiniteQueryOptions({
		queryKey: sourceMediaQueryKeys.results({
			sourceId: input.sourceId,
			conditionKey: input.conditionKey,
			sort: input.sort,
			order: input.order,
			limit: input.limit,
		}),
		queryFn: async ({ pageParam, signal }): Promise<MediaSearchResponse> => {
			if (!input.sourceId) {
				throw new Error("Media source ID is required");
			}
			return await input.searchMedia(
				input.sourceId,
				{
					condition: input.condition || undefined,
					sort: input.sort,
					order: input.order,
					limit: input.limit,
					offset: typeof pageParam === "number" ? pageParam : 0,
				},
				signal,
			);
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			const loadedCount = allPages.reduce(
				(sum, page) => sum + page.media.length,
				0,
			);
			return loadedCount < lastPage.total ? loadedCount : undefined;
		},
		placeholderData: keepPreviousData,
		enabled: input.enabled,
	});
}
