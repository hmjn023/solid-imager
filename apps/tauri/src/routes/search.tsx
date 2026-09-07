import { persistSearchScrollPosition } from "@solid-imager/ui/hooks/use-current-search-persistence";
import { useSearchHistoryPersistence } from "@solid-imager/ui/hooks/use-search-history-persistence";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { V2SearchScreen } from "@solid-imager/ui/screens/v2-search-screen";
import { createSearchHistoryClient } from "@solid-imager/ui/search-history-client";
import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { activateSimilaritySearch } from "@solid-imager/ui/stores/search-store";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { V2MediaGridItem } from "~/components/media/v2-media-grid-item";
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
	const navigate = useNavigate();
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
		<V2SearchScreen
			enableVirtualization
			filterData={page.filterData}
			onFindSimilar={(media) =>
				activateSimilaritySearch(media.id, { surface: "v2" })
			}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media, options) => (
				<V2MediaGridItem
					imageLoadPolicy={options?.imageLoadPolicy}
					isBulkSelectMode={options?.isBulkSelectMode}
					isPreviewSelected={options?.isPreviewSelected}
					isSelected={options?.isSelected}
					media={media}
					onOpenMediaDetail={options?.onOpenMediaDetail}
					onPrepareMediaDetail={options?.onPrepareMediaDetail}
					onPreviewSelect={options?.onPreviewSelect}
					onSelectGesture={options?.onSelectGesture}
					onToggleSelect={options?.onToggleSelect}
					priority={options?.priority}
					sourceRootPath={page.getSourceRootPath(media.mediaSourceId)}
				/>
			)}
			onOpenMediaDetail={(media) =>
				void navigate({
					params: {
						mediaId: media.id,
						mediaSourceId: media.mediaSourceId,
					},
					to: "/sources/$mediaSourceId/$mediaId",
				})
			}
			selectedSource={searchState.selectedSource}
			sources={page.sources()}
		/>
	);
}
