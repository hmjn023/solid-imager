import { Button } from "@solid-imager/ui/button";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/search")({
	ssr: true,
	beforeLoad: ({ context }) => {
		void context;
	},
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(tagsQueryOptions()),
			context.queryClient.ensureQueryData(mediaSourcesQueryOptions()),
			context.queryClient.ensureQueryData(allProjectsQueryOptions()),
			context.queryClient.ensureQueryData(allIpsQueryOptions()),
			context.queryClient.ensureQueryData(allCharactersQueryOptions()),
			context.queryClient.ensureQueryData(allAuthorsQueryOptions()),
		]);
	},
	component: Search,
});

import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { isServer, Portal } from "solid-js/web";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { useCurrentSearchPersistence } from "~/hooks/use-current-search-persistence";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { allAuthorsQueryOptions } from "~/infrastructure/api-clients/queries/authors-query";
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import { tagsQueryOptions } from "~/infrastructure/api-clients/queries/tags-query";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	getSearchCondition,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";

export default function Search() {
	const queryClient = useQueryClient();

	// Enable search persistence for global search
	useCurrentSearchPersistence("all", PresetClient);

	const page = useSearchPage({
		searchMedia,
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
	});

	// Subscribe to real-time events
	useMediaSourceEvents(() => searchState.selectedSource || undefined, {
		onMediaAdded: page.refreshSearchResults,
		onMediaDeleted: page.refreshSearchResults,
		onMediaChanged: page.refreshSearchResults,
	});

	return (
		<SearchScreen
			filterData={page.filterData}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media) => <MediaGridItem media={media} />}
			renderNavActions={({ openMobileFilters }) => (
				<Show when={!isServer && document.getElementById("nav-actions")}>
					<Portal mount={document.getElementById("nav-actions") as HTMLElement}>
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
					</Portal>
				</Show>
			)}
			selectedSource={searchState.selectedSource}
			sources={page.sources()}
			ssrGuard
		/>
	);
}
