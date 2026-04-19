import type { MediaSearchResponse } from "@solid-imager/core/domain/media/schemas";
import { Button } from "@solid-imager/ui/button";
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
import { SearchControlPanel } from "@solid-imager/ui/search-control-panel";
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
	useQueryClient,
} from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
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

const QUERY_GC_TIME = 1000 * 60 * 5;
const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;

function SearchRoute() {
	const queryClient = useQueryClient();
	const [isRestored, setIsRestored] = createSignal(false);
	const [refreshTimer, setRefreshTimer] = createSignal<ReturnType<
		typeof setTimeout
	> | null>(null);

	useCurrentSearchPersistence("all", PresetClient);

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

	const conditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

	const searchResultQuery = createInfiniteQuery<MediaSearchResponse>(() => {
		const source = searchState.selectedSource || undefined;
		return {
			queryKey: [
				"searchResults",
				source,
				conditionKey(),
				searchState.sortBy,
				searchState.sortOrder,
				searchState.limit,
			],
			queryFn: async ({ pageParam }) =>
				await searchMedia(source, {
					condition: getSearchCondition() || undefined,
					sort: searchState.sortBy,
					order: searchState.sortOrder,
					limit: searchState.limit,
					offset: Number(pageParam ?? 0),
				}),
			initialPageParam: 0,
			getNextPageParam: (lastPage, allPages) => {
				const loadedCount = allPages.reduce(
					(sum, page) => sum + page.media.length,
					0,
				);
				if (loadedCount < lastPage.total) {
					return loadedCount;
				}
			},
			placeholderData: keepPreviousData,
			gcTime: QUERY_GC_TIME,
		};
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

	const searchResults = createMemo(() => {
		const seen = new Set<string>();
		return (
			searchResultQuery.data?.pages.flatMap((page) => page.media) || []
		).filter((media) => {
			if (seen.has(media.id)) {
				return false;
			}
			seen.add(media.id);
			return true;
		});
	});

	createEffect(() => {
		if (
			!(searchResultQuery.isLoading || isRestored()) &&
			searchResultQuery.data &&
			searchResultQuery.data.pages.length > 0 &&
			searchState.scrollY > 0
		) {
			requestAnimationFrame(() => {
				window.scrollTo(0, searchState.scrollY);
			});
			setIsRestored(true);
		}
	});

	onCleanup(() => {
		setSearchState("scrollY", window.scrollY);
		const timer = refreshTimer();
		if (timer) {
			clearTimeout(timer);
		}
	});

	const handleSearch = () => {
		setSearchState("offset", 0);
		setSearchState("scrollY", 0);
		window.scrollTo(0, 0);
	};

	const [loadMoreRef, setLoadMoreRef] = createSignal<
		HTMLDivElement | undefined
	>(undefined);

	createEffect(() => {
		const element = loadMoreRef();
		if (!element) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (
					entries[0].isIntersecting &&
					searchResultQuery.hasNextPage &&
					!searchResultQuery.isFetchingNextPage
				) {
					void searchResultQuery.fetchNextPage();
				}
			},
			{ threshold: 0.5, rootMargin: "1000px" },
		);

		observer.observe(element);
		onCleanup(() => observer.disconnect());
	});

	const panel = (
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
	);

	return (
		<main class="container mx-auto p-4">
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

			<div class="grid gap-6 md:grid-cols-[300px_1fr]">
				<Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
					<CardHeader>
						<CardTitle>検索フィルター</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">{panel}</CardContent>
				</Card>

				<div class="space-y-4">
					<div class="mb-4 flex items-center justify-between">
						<p class="text-gray-600 text-sm">
							{searchResultQuery.data?.pages[0]?.total ?? 0} 件の結果
						</p>
					</div>

					<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						<For each={searchResults()}>
							{(media) => (
								<MediaGridItem
									media={media}
									sourceRootPath={getSourceRootPath(media.mediaSourceId)}
								/>
							)}
						</For>
					</div>

					<Show
						when={searchResults().length === 0 && !searchResultQuery.isLoading}
					>
						<div class="py-12 text-center text-gray-500">
							検索結果が見つかりませんでした
						</div>
					</Show>

					<div ref={setLoadMoreRef} />
				</div>
			</div>
		</main>
	);
}
