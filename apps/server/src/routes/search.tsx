import { Button } from "@solid-imager/ui/button";
import { persistSearchScrollPosition } from "@solid-imager/ui/hooks/use-current-search-persistence";
import { useSearchHistoryPersistence } from "@solid-imager/ui/hooks/use-search-history-persistence";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { createSearchHistoryClient } from "@solid-imager/ui/search-history-client";
import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import { LegacyMediaGridItem } from "~/components/media/legacy-media-grid-item";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import { SearchHistoryClient as rawSearchHistoryClient } from "~/infrastructure/api/clients/search-history-client";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import {
	searchMedia,
	searchSimilar,
} from "~/infrastructure/api-clients/search-api";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";
import {
	getSearchCondition,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";

export const Route = createFileRoute("/search")({
	validateSearch: searchHistoryQuerySchema,
	ssr: true,
	loader: async ({ context, preload }: RouteLoaderContext) => {
		if (preload && typeof window !== "undefined") {
			void Promise.allSettled([
				context.queryClient.prefetchQuery(mediaSourcesQueryOptions()),
				context.queryClient.prefetchQuery(allProjectsQueryOptions()),
				context.queryClient.prefetchQuery(allIpsQueryOptions()),
				context.queryClient.prefetchQuery(allCharactersQueryOptions()),
				context.queryClient.prefetchQuery(allAuthorsQueryOptions()),
			]);
			await context.queryClient.prefetchQuery(tagsQueryOptions());
			return;
		}
		if (typeof window !== "undefined" && !preload) {
			return;
		}
		await Promise.all([
			context.queryClient.prefetchQuery(tagsQueryOptions()),
			context.queryClient.prefetchQuery(mediaSourcesQueryOptions()),
			context.queryClient.prefetchQuery(allProjectsQueryOptions()),
			context.queryClient.prefetchQuery(allIpsQueryOptions()),
			context.queryClient.prefetchQuery(allCharactersQueryOptions()),
			context.queryClient.prefetchQuery(allAuthorsQueryOptions()),
		]);
	},
	pendingComponent: SearchRouteFallback,
	pendingMinMs: 0,
	component: SearchRouteBoundary,
});

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;

const PresetClient = createPresetClient(rawPresetClient);
const SearchHistoryClient = createSearchHistoryClient(rawSearchHistoryClient);

function SearchRouteBoundary() {
	const [isMounted, setIsMounted] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	return (
		<Show fallback={<SearchRouteFallback />} when={isMounted()}>
			{(_mounted) => <SearchRoute />}
		</Show>
	);
}

function SearchRouteFallback() {
	return (
		<RouteDataPendingScreen
			description="検索画面を準備しています..."
			layout="media-grid"
			showDescription
			title="メディア検索"
		/>
	);
}

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
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media, options) => (
				<LegacyMediaGridItem
					imageLoadPolicy={options?.imageLoadPolicy}
					media={media}
					priority={options?.priority}
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
