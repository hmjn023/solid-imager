import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/search')({
  component: RouteComponent,
})

import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
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
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
	useQueryClient,
} from "@tanstack/solid-query";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { isServer, Portal } from "solid-js/web";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { SearchControlPanel } from "~/components/media/search-control-panel";
import { useCurrentSearchPersistence } from "~/hooks/use-current-search-persistence";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { fetchAllAuthors } from "~/infrastructure/api-clients/authors-api";
import { fetchAllCharacters } from "~/infrastructure/api-clients/characters-api";
import { fetchAllIps } from "~/infrastructure/api-clients/ips-api";
import { fetchAllProjects } from "~/infrastructure/api-clients/projects-api";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";
import { fetchTags } from "~/infrastructure/api-clients/tags-api";
import {
	getSearchCondition,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";

// Type alias to avoid conflict with DOM MediaSource API
type Source = SafeMediaSource;

const buildSearchParams = (state: typeof searchState) => {
	const condition = getSearchCondition();
	return {
		condition: condition || undefined,
		sort: state.sortBy,
		order: state.sortOrder,
		limit: state.limit,
	};
};

/**
 * Serialize condition as JSON for stable query key comparison.
 * This prevents mode toggles (simple/pro) with equivalent conditions
 * from producing different query keys due to SolidJS store proxy references.
 */
const useStableConditionKey = () =>
	createMemo(() => JSON.stringify(getSearchCondition() ?? null));

// biome-ignore lint/style/noMagicNumbers: Standard time calculation
const QUERY_GC_TIME = 1000 * 60 * 5;

function RouteComponent() {
	const queryClient = useQueryClient();

	// Enable search persistence for global search
	useCurrentSearchPersistence("all");

	const [isRestored, setIsRestored] = createSignal(false);
	const [isMounted, setIsMounted] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	createEffect(() => {
		if (isServer) {
			return;
		}
		// Restoration logic: wait until not loading and haven't restored yet
		if (
			!(searchResultQuery.isLoading || isRestored()) &&
			searchResultQuery.data &&
			searchResultQuery.data.pages.length > 0 &&
			searchState.scrollY > 0
		) {
			// Restore scroll position
			// Use requestAnimationFrame to ensure DOM is updated
			requestAnimationFrame(() => {
				window.scrollTo(0, searchState.scrollY);
			});
			setIsRestored(true);
		}
	});

	onCleanup(() => {
		if (isServer) {
			return;
		}
		setSearchState("scrollY", window.scrollY);
	});

	// Fetch filter data
	const tags = createQuery<TagResponse[]>(() => ({
		queryKey: ["tags"],
		queryFn: fetchTags,
	}));
	const sources = createQuery<Source[]>(() => ({
		queryKey: ["mediaSources"],
		queryFn: fetchMediaSources,
	}));
	const allProjects = createQuery(() => ({
		queryKey: ["allProjects"],
		queryFn: fetchAllProjects,
	}));
	const allIps = createQuery(() => ({
		queryKey: ["allIps"],
		queryFn: fetchAllIps,
	}));
	const allCharacters = createQuery(() => ({
		queryKey: ["allCharacters"],
		queryFn: fetchAllCharacters,
	}));
	const allAuthors = createQuery(() => ({
		queryKey: ["allAuthors"],
		queryFn: fetchAllAuthors,
	}));

	// Use only effective search params as query key to avoid unnecessary refetches
	// (e.g., mode toggle with equivalent conditions should NOT refetch)
	const conditionKey = useStableConditionKey();

	const searchResultQuery = createInfiniteQuery(() => {
		const params = buildSearchParams(searchState);
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
					...params,
					offset: pageParam as number,
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
			gcTime: QUERY_GC_TIME, // Keep cache for 5 minutes for scroll restoration
		};
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

	const searchResults = createMemo(() => {
		const seen = new Set<string>();
		return (searchResultQuery.data?.pages.flatMap((p) => p.media) || []).filter(
			(m) => {
				if (seen.has(m.id)) {
					return false;
				}
				seen.add(m.id);
				return true;
			},
		);
	});

	const handleSearch = () => {
		setSearchState("offset", 0);
		setSearchState("scrollY", 0);
		window.scrollTo(0, 0);
	};

	// Infinite scroll trigger
	const [loadMoreRef, setLoadMoreRef] = createSignal<
		HTMLDivElement | undefined
	>(undefined);

	createEffect(() => {
		const el = loadMoreRef();
		if (isServer || !el) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (
					entries[0].isIntersecting &&
					searchResultQuery.hasNextPage &&
					!searchResultQuery.isFetchingNextPage
				) {
					searchResultQuery.fetchNextPage();
				}
			},
			{ threshold: 0.5, rootMargin: "1000px" },
		);

		observer.observe(el);
		onCleanup(() => observer.disconnect());
	});

	return (
		<main class="container mx-auto p-4">
			<Show when={!isServer}>
				{/* biome-ignore lint/style/noNonNullAssertion: nav-actions is guaranteed to exist in Nav component */}
				<Portal mount={document.getElementById("nav-actions")!}>
					<Dialog>
						<DialogTrigger
							as={Button}
							class="border-white text-white hover:bg-sky-700 md:hidden"
							size="icon"
							variant="outline"
						>
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: Filter icon */}
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
