import { Button } from "@solid-imager/ui/button";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
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

export const Route = createFileRoute("/search")({
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
	component: SearchRoute,
});

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;

function SearchRoute() {
	const queryClient = useQueryClient();

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
			filterData={page.filterData}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media) => (
				<MediaGridItem
					media={media}
					sourceRootPath={page.getSourceRootPath(media.mediaSourceId)}
				/>
			)}
			renderNavActions={({ openMobileFilters }) => (
				<div class="md:hidden">
					<Button onClick={openMobileFilters} variant="outline">
						Filters
					</Button>
				</div>
			)}
			selectedSource={searchState.selectedSource}
			sources={page.sources()}
		/>
	);
}
