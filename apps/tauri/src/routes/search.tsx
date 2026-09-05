import { Button } from "@solid-imager/ui/button";
import { persistSearchScrollPosition } from "@solid-imager/ui/hooks/use-current-search-persistence";
import { useSearchHistoryPersistence } from "@solid-imager/ui/hooks/use-search-history-persistence";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { createSearchHistoryClient } from "@solid-imager/ui/search-history-client";
import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { activateSimilaritySearch } from "@solid-imager/ui/stores/search-store";
import { createFileRoute } from "@tanstack/solid-router";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import { SearchHistoryClient as rawSearchHistoryClient } from "~/infrastructure/api/clients/search-history-client";
import {
	searchMedia,
	searchSimilar,
} from "~/infrastructure/api-clients/search-api";
import {
	getSearchCondition,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/queries";

export const Route = createFileRoute("/search")({
	validateSearch: searchHistoryQuerySchema,
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(tagsQueryOptions());
		void context.queryClient.prefetchQuery(mediaSourcesQueryOptions());
		void context.queryClient.prefetchQuery(allProjectsQueryOptions());
		void context.queryClient.prefetchQuery(allIpsQueryOptions());
		void context.queryClient.prefetchQuery(allCharactersQueryOptions());
		void context.queryClient.prefetchQuery(allAuthorsQueryOptions());
	},
	component: SearchRoute,
});

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;

const PresetClient = createPresetClient(rawPresetClient);
const SearchHistoryClient = createSearchHistoryClient(rawSearchHistoryClient);

function SearchRoute() {
	const searchHistory = useSearchHistoryPersistence("all", {
		client: SearchHistoryClient,
	});

	const page = useSearchPage({
		searchMedia,
		searchSimilar,
		queries: {
			tags: tagsQueryOptions,
			sources: mediaSourcesQueryOptions,
			projects: allProjectsQueryOptions,
			ips: allIpsQueryOptions,
			characters: allCharactersQueryOptions,
			authors: allAuthorsQueryOptions,
		},
		selectedSource: () => searchState.selectedSource,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
		limit: () => searchState.limit,
		scrollY: () => searchState.scrollY,
		setScrollY: (y) => {
			setSearchState("scrollY", y);
			persistSearchScrollPosition("all", y, {
				historyEntryKey: searchHistory.historyEntryKey,
			});
		},
		setOffset: (o) => setSearchState("offset", o),
		mode: () => searchState.mode,
		similarityAnchorMediaId: () => searchState.similarityAnchorMediaId,
		similarityTopK: () => searchState.similarityTopK,
		refreshDebounceMs: SEARCH_RESULTS_REFRESH_DEBOUNCE_MS,
		isSearchStateRestored: searchHistory.isRestored,
		commitSearchHistory: searchHistory.commitNow,
		historyEntryKey: searchHistory.historyEntryKey,
		enableVirtualization: true,
	});

	useMediaSourceEvents(() => searchState.selectedSource || "*", {
		onMediaAdded: page.refreshSearchResults,
		onMediaDeleted: page.refreshSearchResults,
		onMediaChanged: page.refreshSearchResults,
		onMediaCopied: page.refreshSearchResults,
		onMediaMoved: page.refreshSearchResults,
		onAllJobsCompleted: page.refreshSearchResults,
	});

	return (
		<SearchScreen
			enableVirtualization
			filterData={page.filterData}
			onFindSimilar={(media) => activateSimilaritySearch(media.id)}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media, options) => (
				<MediaGridItem
					imageLoadPolicy={options?.imageLoadPolicy}
					media={media}
					priority={options?.priority}
					sourceRootPath={page.getSourceRootPath(media.mediaSourceId)}
				/>
			)}
			renderNavActions={({ openMobileFilters }) => (
				<Button
					class="size-11 border-input text-foreground hover:bg-accent md:hidden"
					onClick={openMobileFilters}
					size="icon"
					variant="outline"
				>
					<svg
						class="lucide lucide-filter"
						fill="none"
						height="24"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						width="24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Filter results</title>
						<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
					</svg>
				</Button>
			)}
			selectedSource={searchState.selectedSource}
			sources={page.sources()}
		/>
	);
}
