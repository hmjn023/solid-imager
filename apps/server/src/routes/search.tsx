import { Button } from "@solid-imager/ui/button";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { prefetchQueryOnClient } from "@solid-imager/ui/query-options";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { useCurrentSearchPersistence } from "~/hooks/use-current-search-persistence";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";

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
import {
	getSearchCondition,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";

export const Route = createFileRoute("/search")({
	loader: ({ context }) => {
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(tagsQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(mediaSourcesQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allProjectsQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allIpsQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allCharactersQueryOptions()),
		);
		prefetchQueryOnClient(() =>
			context.queryClient.prefetchQuery(allAuthorsQueryOptions()),
		);
	},
	component: SearchRoute,
});

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;

const PresetClient = createPresetClient(rawPresetClient);

function SearchRoute() {
	const queryClient = useQueryClient();

	useCurrentSearchPersistence("all", PresetClient);

	const page = useSearchPage({
		searchMedia,
		searchSimilar,
		queryClient,
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
		setScrollY: (y) => setSearchState("scrollY", y),
		setOffset: (o) => setSearchState("offset", o),
		mode: () => searchState.mode,
		similarityAnchorMediaId: () => searchState.similarityAnchorMediaId,
		similarityTopK: () => searchState.similarityTopK,
		refreshDebounceMs: SEARCH_RESULTS_REFRESH_DEBOUNCE_MS,
	});

	useMediaSourceEvents(() => searchState.selectedSource || undefined, {
		onMediaAdded: page.refreshSearchResults,
		onMediaDeleted: page.refreshSearchResults,
		onMediaChanged: page.refreshSearchResults,
		onAllJobsCompleted: page.refreshSearchResults,
	});

	return (
		<SearchScreen
			enableVirtualization
			filterData={page.filterData}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media) => <MediaGridItem media={media} />}
			renderNavActions={({ openMobileFilters }) => (
				<Button
					class="border-white text-white hover:bg-sky-700 md:hidden"
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
