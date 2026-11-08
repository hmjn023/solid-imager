import type { Media } from "@solid-imager/core/media";
import type { SimilarityModel } from "@solid-imager/core/search";
import type { SearchHistoryClient } from "../search-history-client";
import {
	activateSimilaritySearch,
	getSearchCondition,
	searchState,
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
	const history = useSearchHistoryPersistence("all", {
		client: options.historyClient,
	});
	const page = useSearchPage({
		searchMedia: options.searchMedia,
		searchSimilar: options.searchSimilar,
		searchSemantic: options.searchSemantic,
		queries: options.queries,
		similarityModel: () => searchState.similarityModel,
		semanticQuery: () => searchState.semanticQuery,
		selectedSource: () => searchState.selectedSource,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
		// Fetch complete rows for up to eight columns without tiny scroll pages.
		limit: () => Math.max(searchState.limit, 200),
		scrollY: () => searchState.scrollY,
		setScrollY: (value) => {
			setSearchState("scrollY", value);
			persistSearchScrollPosition("all", value, {
				historyEntryKey: history.historyEntryKey,
			});
		},
		setOffset: (value) => setSearchState("offset", value),
		mode: () => searchState.mode,
		similarityAnchorMediaId: () => searchState.similarityAnchorMediaId,
		similarityTopK: () => searchState.similarityTopK,
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
		selectedSource: () => searchState.selectedSource,
		selectSource: (id: string) => setSearchState("selectedSource", id),
		findSimilar: (media: Media, model?: SimilarityModel) =>
			activateSimilaritySearch(media.id, model),
	};
}

export type SearchWorkspaceController = ReturnType<typeof useSearchWorkspace>;
