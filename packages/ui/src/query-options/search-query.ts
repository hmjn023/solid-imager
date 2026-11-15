import { t } from "@solid-imager/i18n";
import { getSearchExecutionKind } from "../search-execution";
import type {
	SearchCriterion,
	SearchGroup,
	SimilarityModel,
	SemanticSearchRequest,
} from "@solid-imager/core/search";
import type {
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/media";
import {
	type InfiniteData,
	infiniteQueryOptions,
	keepPreviousData,
} from "@tanstack/solid-query";

export const MEDIA_RESULTS_STALE_TIME_MS = 1000 * 60 * 5;

export type SearchResultsQueryKeyInput = {
	similarityModel?: SimilarityModel;
	semanticQuery?: string;
	mode: "simple" | "pro";
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
		["searchResults", activeSearchKey(input)] as const,
};

export type SourceMediaQueryKeyInput = {
	similarityAnchorMediaId?: string | null;
	similarityModel?: SimilarityModel;
	semanticQuery?: string;
	similarityTopK?: number;
	sourceId: string | undefined;
	conditionKey: string;
	sort: string | undefined;
	order: "asc" | "desc";
	limit: number;
};

/** Cache only applied inputs. Suspended normal filters and editor format do not change vector results. */
function activeSearchKey(input: SourceMediaQueryKeyInput) {
	const kind = getSearchExecutionKind(input);
	const base = { kind, sourceId: input.sourceId, limit: input.limit };
	if (kind === "semantic")
		return {
			...base,
			semanticQuery: input.semanticQuery?.trim(),
			similarityTopK: input.similarityTopK ?? 1000,
		};
	if (kind === "similarity")
		return {
			...base,
			similarityAnchorMediaId: input.similarityAnchorMediaId,
			similarityModel: input.similarityModel ?? "ccip",
			similarityTopK: input.similarityTopK ?? 1000,
		};
	return {
		...base,
		conditionKey: input.conditionKey,
		sort: input.sort,
		order: input.order,
	};
}

export const sourceMediaQueryKeys = {
	all: () => ["media"] as const,
	forSource: (sourceId: string | undefined) => ["media", sourceId] as const,
	results: (input: SourceMediaQueryKeyInput) =>
		["media", input.sourceId, activeSearchKey(input)] as const,
};

/** Matches source-specific infinite result keys without matching other media cache entries. */
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
		"kind" in input
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
		model?: SimilarityModel;
		anchorMediaId: string;
		mediaSourceId?: string;
		topK: number;
		limit: number;
		offset: number;
	},
	signal?: AbortSignal,
) => Promise<MediaSearchResponse>;

export type SearchResultsQueryOptionsInput = {
	similarityModel?: SimilarityModel;
	semanticQuery?: string;
	searchSemantic?: (
		input: SemanticSearchRequest,
		signal?: AbortSignal,
	) => Promise<MediaSearchResponse>;
	mode: "simple" | "pro";
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

function filtersActivity(node: SearchGroup | SearchCriterion): boolean {
	return node.type === "group"
		? node.children.some(filtersActivity)
		: ["favorite", "rating", "viewCount"].includes(node.target);
}

function usesMediaActivity(
	input: Pick<SearchResultsQueryOptionsInput, "sort" | "condition"> &
		Partial<
			Pick<
				SearchResultsQueryOptionsInput,
				"semanticQuery" | "similarityAnchorMediaId"
			>
		>,
) {
	return (
		getSearchExecutionKind(input) === "ordinary" &&
		(input.sort === "rating" ||
			input.sort === "viewCount" ||
			Boolean(input.condition && filtersActivity(input.condition)))
	);
}

async function executeSearch(
	input: SearchResultsQueryOptionsInput,
	pageParam: number,
	signal: AbortSignal,
): Promise<MediaSearchResponse> {
	if (getSearchExecutionKind(input) === "semantic") {
		if (!input.searchSemantic)
			throw new Error(t("searchQuery.naturalLanguageSearchIsUnavailable"));
		return input.searchSemantic(
			{
				text: input.semanticQuery?.trim() ?? "",
				mediaSourceId: input.sourceId,
				topK: input.similarityTopK,
				limit: Math.min(input.limit, 200),
				offset: typeof pageParam === "number" ? pageParam : 0,
			},
			signal,
		);
	}
	if (
		getSearchExecutionKind(input) === "similarity" &&
		input.similarityAnchorMediaId
	) {
		if (!input.searchSimilar) {
			throw new Error(t("searchQuery.similaritySearchIsUnavailable"));
		}
		return await input.searchSimilar(
			{
				anchorMediaId: input.similarityAnchorMediaId,
				...(input.similarityModel ? { model: input.similarityModel } : {}),
				mediaSourceId: input.sourceId,
				topK: input.similarityTopK,
				limit: Math.min(input.limit, 200),
				offset: typeof pageParam === "number" ? pageParam : 0,
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
}

/** Creates paged search options for either ordinary or similarity ordering. */
export function buildSearchResultsQueryOptions(
	input: SearchResultsQueryOptionsInput,
) {
	return infiniteQueryOptions({
		meta: { usesMediaActivity: usesMediaActivity(input) },
		queryKey: searchQueryKeys.results({
			mode: input.mode,
			sourceId: input.sourceId,
			conditionKey: input.conditionKey,
			sort: input.sort,
			order: input.order,
			limit: input.limit,
			similarityAnchorMediaId: input.similarityAnchorMediaId,
			similarityTopK: input.similarityTopK,
			similarityModel: input.similarityModel,
			semanticQuery: input.semanticQuery,
		}),
		queryFn: ({ pageParam, signal }) => executeSearch(input, pageParam, signal),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			if (lastPage.media.length === 0) return;
			const loadedCount = allPages.reduce(
				(sum, page) => sum + page.media.length,
				0,
			);
			return loadedCount < lastPage.total ? loadedCount : undefined;
		},
		// Similarity result sets have a user-selected size. Keeping the previous
		// result while changing topK makes selecting 100 look like a no-op.
		placeholderData:
			getSearchExecutionKind(input) === "ordinary"
				? keepPreviousData
				: undefined,
		enabled: input.enabled,
		gcTime: input.gcTime,
		staleTime: MEDIA_RESULTS_STALE_TIME_MS,
	});
}

export type SourceMediaResultsQueryOptionsInput = {
	similarityAnchorMediaId?: string | null;
	similarityModel?: SimilarityModel;
	searchSimilar?: SearchSimilar;
	semanticQuery?: string;
	similarityTopK?: number;
	searchSemantic?: (
		input: SemanticSearchRequest,
		signal?: AbortSignal,
	) => Promise<MediaSearchResponse>;
	sourceId: string | undefined;
	condition: MediaSearchRequest["condition"];
	conditionKey: string;
	sort: MediaSearchRequest["sort"];
	order: "asc" | "desc";
	limit: number;
	searchMedia: SearchSourceMedia;
	enabled?: boolean;
};

/** Builds an infinite query for a source collection with its filter, ordering, and pagination in the cache key. */
export function buildSourceMediaResultsQueryOptions(
	input: SourceMediaResultsQueryOptionsInput,
) {
	return infiniteQueryOptions({
		meta: { usesMediaActivity: usesMediaActivity(input) },
		queryKey: sourceMediaQueryKeys.results({
			similarityAnchorMediaId: input.similarityAnchorMediaId,
			similarityModel: input.similarityModel,
			...(input.semanticQuery !== undefined
				? { semanticQuery: input.semanticQuery }
				: {}),
			...(input.similarityTopK !== undefined
				? { similarityTopK: input.similarityTopK }
				: {}),
			sourceId: input.sourceId,
			conditionKey: input.conditionKey,
			sort: input.sort,
			order: input.order,
			limit: input.limit,
		}),
		queryFn: async ({ pageParam, signal }): Promise<MediaSearchResponse> => {
			if (!input.sourceId)
				throw new Error(t("searchQuery.mediaSourceIDIsRequired"));
			return executeSearch(
				{
					...input,
					mode: "simple",
					similarityAnchorMediaId: input.similarityAnchorMediaId ?? null,
					similarityTopK: input.similarityTopK ?? 1000,
					searchSimilar: input.searchSimilar,
					searchMedia: (_sourceId, params, signal) => {
						if (!input.sourceId)
							throw new Error(t("searchQuery.mediaSourceIDIsRequired"));
						return input.searchMedia(input.sourceId, params, signal);
					},
				},
				pageParam,
				signal,
			);
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			if (lastPage.media.length === 0) return;
			const loadedCount = allPages.reduce(
				(sum, page) => sum + page.media.length,
				0,
			);
			return loadedCount < lastPage.total ? loadedCount : undefined;
		},
		placeholderData:
			getSearchExecutionKind(input) === "ordinary"
				? keepPreviousData
				: undefined,
		enabled: input.enabled,
		staleTime: MEDIA_RESULTS_STALE_TIME_MS,
	});
}
