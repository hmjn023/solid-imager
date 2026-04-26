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

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { SearchControlPanel } from "@solid-imager/ui/search-control-panel";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, onMount, Show } from "solid-js";
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

	const [isMounted, setIsMounted] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	const { searchResultQuery, searchResults, handleSearch, setLoadMoreRef } =
		useSearchPage({
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

	// Subscribe to real-time events
	useMediaSourceEvents(() => searchState.selectedSource || undefined, {
		onMediaAdded: () => {
			queryClient.invalidateQueries({ queryKey: ["searchResults"] });
		},
		onMediaDeleted: () => {
			queryClient.invalidateQueries({ queryKey: ["searchResults"] });
		},
		onMediaChanged: () => {
			queryClient.invalidateQueries({ queryKey: ["searchResults"] });
		},
	});

	// Fetch filter data
	const tags = createQuery(() => tagsQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());

	return (
		<main class="container mx-auto p-4">
			<Show when={!isServer && document.getElementById("nav-actions")}>
				<Portal mount={document.getElementById("nav-actions") as HTMLElement}>
					<Dialog>
						<DialogTrigger
							as={Button}
							class="border-white text-white hover:bg-sky-700 md:hidden"
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
						</DialogTrigger>
						<DialogContent class="max-h-[80vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>検索フィルター</DialogTitle>
							</DialogHeader>
							<div class="space-y-4">
								<SearchControlPanel
									context="global"
									filterData={{
										tags: tags.data,
										projects: allProjects.data,
										ips: allIps.data,
										characters: allCharacters.data,
										authors: allAuthors.data,
									}}
									onSearch={handleSearch}
									onSelectSource={(id) => setSearchState("selectedSource", id)}
									presetClient={PresetClient}
									selectedSource={searchState.selectedSource}
									sources={sources.data}
								/>
							</div>
						</DialogContent>
					</Dialog>
				</Portal>
			</Show>

			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 font-bold text-3xl">メディア検索</h1>
					<p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
				</div>
			</div>

			<div class="grid gap-6 md:grid-cols-[300px_1fr]">
				{/* Search Filters (Desktop only) */}
				<Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
					<CardHeader>
						<CardTitle>検索フィルター</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<SearchControlPanel
							context="global"
							filterData={{
								tags: tags.data,
								projects: allProjects.data,
								ips: allIps.data,
								characters: allCharacters.data,
								authors: allAuthors.data,
							}}
							onSearch={handleSearch}
							onSelectSource={(id) => setSearchState("selectedSource", id)}
							presetClient={PresetClient}
							selectedSource={searchState.selectedSource}
							sources={sources.data}
							usePopover={false}
						/>
					</CardContent>
				</Card>

				{/* Search Results */}
				<div class="space-y-4">
					<Show
						fallback={<div class="py-8 text-center">読み込み中...</div>}
						when={!searchResultQuery.isLoading && isMounted()}
					>
						<Show
							fallback={
								<div class="py-12 text-center text-gray-500">
									{/* Should not happen if data is loaded, but handled by inner Show */}
								</div>
							}
							when={searchResultQuery.data}
						>
							<div class="mb-4 flex items-center justify-between">
								<p class="text-gray-600 text-sm">
									{searchResultQuery.data?.pages[0]?.total || 0} 件の結果
								</p>
							</div>

							<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
								<For each={searchResults()}>
									{(media) => <MediaGridItem media={media} />}
								</For>
							</div>

							<div class="h-10 w-full" ref={setLoadMoreRef}>
								<Show when={searchResultQuery.isFetchingNextPage}>
									<div class="py-4 text-center text-gray-500">
										読み込み中...
									</div>
								</Show>
							</div>

							<Show when={(searchResultQuery.data?.pages[0]?.total || 0) === 0}>
								<div class="py-12 text-center text-gray-500">
									検索結果が見つかりませんでした
								</div>
							</Show>
						</Show>
					</Show>
				</div>
			</div>
		</main>
	);
}
