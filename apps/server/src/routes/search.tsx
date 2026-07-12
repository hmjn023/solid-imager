import { Button } from "@solid-imager/ui/button";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
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
	// SearchScreen is client-only, but this route itself must render on the
	// server so its static fallback hydrates against the same component tree.
	ssr: true,
	pendingComponent: SearchRouteFallback,
	component: SearchRoute,
});

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;

const PresetClient = createPresetClient(rawPresetClient);

function SearchRoute() {
	const [isMounted, setIsMounted] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	return (
		<Show fallback={<SearchRouteFallback />} when={isMounted()}>
			{(_mounted) => <SearchRouteContent />}
		</Show>
	);
}

function SearchRouteFallback() {
	return (
		<main class="container mx-auto p-4">
			<section
				aria-live="polite"
				class="flex min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground"
				role="status"
			>
				<h1 class="font-bold text-2xl text-foreground">メディア検索</h1>
				<p>検索画面を準備しています...</p>
			</section>
		</main>
	);
}

function SearchRouteContent() {
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
