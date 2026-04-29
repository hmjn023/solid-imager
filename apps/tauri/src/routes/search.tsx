import { Button } from "@solid-imager/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@solid-imager/ui/dialog";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, onCleanup } from "solid-js";
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
import { getSearchCondition, searchState, setSearchState } from "~/presentation/store/search-store";

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
	const [refreshTimer, setRefreshTimer] = createSignal<ReturnType<typeof setTimeout> | null>(null);

	useCurrentSearchPersistence("all", PresetClient);

	const page = useSearchPage({
		searchMedia,
		queryClient,
		selectedSource: () => searchState.selectedSource,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
		limit: () => searchState.limit,
		scrollY: () => searchState.scrollY,
		setScrollY: (y) => setSearchState("scrollY", y),
		setOffset: (o) => setSearchState("offset", o),
	});

	const scheduleSearchResultsRefresh = () => {
		const timer = refreshTimer();
		if (timer) {
			clearTimeout(timer);
		}
		setRefreshTimer(
			setTimeout(() => {
				void queryClient.invalidateQueries({ queryKey: ["searchResults"] });
				setRefreshTimer(null);
			}, SEARCH_RESULTS_REFRESH_DEBOUNCE_MS),
		);
	};

	useMediaSourceEvents(() => searchState.selectedSource || undefined, {
		onMediaAdded: scheduleSearchResultsRefresh,
		onMediaDeleted: scheduleSearchResultsRefresh,
		onMediaChanged: scheduleSearchResultsRefresh,
		onAllJobsCompleted: scheduleSearchResultsRefresh,
	});

	const tags = createQuery(() => tagsQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());

	const getSourceRootPath = (mediaSourceId: string) => {
		const source = sources.data?.find((item) => item.id === mediaSourceId);
		if (source?.type !== "local") {
			return undefined;
		}
		const connectionInfo = source.connectionInfo as { path?: string };
		return connectionInfo.path;
	};

	onCleanup(() => {
		const timer = refreshTimer();
		if (timer) {
			clearTimeout(timer);
		}
	});

	return (
		<SearchScreen
			filterData={{
				tags: tags.data,
				projects: allProjects.data,
				ips: allIps.data,
				characters: allCharacters.data,
				authors: allAuthors.data,
			}}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media) => (
				<MediaGridItem
					media={media}
					sourceRootPath={getSourceRootPath(media.mediaSourceId)}
				/>
			)}
			renderNavActions={(panel) => (
				<div class="mb-8 flex items-center justify-between">
					<div>
						<h1 class="mb-2 font-bold text-3xl">メディア検索</h1>
						<p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
					</div>
					<div class="md:hidden">
						<Dialog>
							<DialogTrigger as={Button} variant="outline">
								Filters
							</DialogTrigger>
							<DialogContent class="max-h-[80vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>検索フィルター</DialogTitle>
								</DialogHeader>
								<div class="space-y-4">{panel}</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			)}
			selectedSource={searchState.selectedSource}
			sources={sources.data}
		/>
	);
}
