import type { Media } from "@solid-imager/core/media";
import {
	getSearchConditionFromState,
	type SimilarityModel,
} from "@solid-imager/core/search";
import type { SearchHistoryClient } from "../search-history-client";
import { useRenderedSearchState } from "../search-initial-state";
import { SEARCH_COLLECTION_PAGE_SIZE } from "../query-options/search-query";
import {
	activateSimilaritySearch,
	setSearchState,
} from "../stores/search-store";
import { persistSearchScrollPosition } from "./use-current-search-persistence";
import {
	type MediaCollectionNotifications,
	type MediaCollectionOperations,
	useMediaCollectionActions,
} from "./use-media-collection-actions";
import { useSearchHistoryPersistence } from "./use-search-history-persistence";
import { type UseSearchPageOptions, useSearchPage } from "./use-search-page";

export type SearchWorkspaceOptions = Pick<
	UseSearchPageOptions,
	"searchMedia" | "searchSimilar" | "searchSemantic" | "queries"
> & {
	historyClient: SearchHistoryClient;
	operations: MediaCollectionOperations;
	notify: MediaCollectionNotifications;
};

/** Builds the same search, history, scroll and collection workflows for both apps. */
export function useSearchWorkspace(options: SearchWorkspaceOptions) {
	const state = useRenderedSearchState();
	const history = useSearchHistoryPersistence("all", {
		client: options.historyClient,
	});
	const page = useSearchPage({
		searchMedia: options.searchMedia,
		searchSimilar: options.searchSimilar,
		searchSemantic: options.searchSemantic,
		queries: options.queries,
		similarityModel: () => state().similarityModel,
		semanticQuery: () => state().semanticQuery,
		selectedSource: () => state().selectedSource,
		getSearchCondition: () => getSearchConditionFromState(state()),
		sortBy: () => state().sortBy,
		sortOrder: () => state().sortOrder,
		// Fetch complete rows for up to eight columns without tiny scroll pages.
		limit: () => Math.max(state().limit, SEARCH_COLLECTION_PAGE_SIZE),
		scrollY: () => state().scrollY,
		setScrollY: (value) => {
			setSearchState("scrollY", value);
			persistSearchScrollPosition("all", value, {
				historyEntryKey: history.historyEntryKey,
			});
		},
		setOffset: (value) => setSearchState("offset", value),
		mode: () => state().mode,
		similarityAnchorMediaId: () => state().similarityAnchorMediaId,
		similarityTopK: () => state().similarityTopK,
		refreshDebounceMs: 300,
		isSearchStateRestored: history.isRestored,
		commitSearchHistory: history.commitNow,
		historyEntryKey: history.historyEntryKey,
		enableVirtualization: true,
		scrollContainerSelector: '[data-media-scroll="search"]',
	});
	const actions = useMediaCollectionActions({
		media: page.searchResults,
		refresh: page.refreshSearchResults,
		operations: options.operations,
		notify: options.notify,
	});

	return {
		page,
		history,
		actions,
		selectedSource: () => state().selectedSource,
		selectSource: (id: string) => setSearchState("selectedSource", id),
		findSimilar: (media: Media, model?: SimilarityModel) =>
			activateSimilaritySearch(media.id, model),
	};
}

export type SearchWorkspaceController = ReturnType<typeof useSearchWorkspace>;
