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
import { toast } from "@solid-imager/ui/toast";
import {
	createInfiniteQuery,
	createQuery,
	keepPreviousData,
} from "@tanstack/solid-query";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
import { MediaGridItem } from "../../../components/media/media-grid-item";
import { SearchControlPanel } from "../../../components/media/search-control-panel";
import { useMediaSourceEvents } from "../../../hooks/use-media-source-events";
import { allAuthorsQueryOptions } from "../../../infrastructure/api-clients/queries/authors-query";
import { allCharactersQueryOptions } from "../../../infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "../../../infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "../../../infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "../../../infrastructure/api-clients/queries/sources-query";
import { tagsQueryOptions } from "../../../infrastructure/api-clients/queries/tags-query";
import { searchMedia } from "../../../infrastructure/api-clients/search-api";
import {
	getSearchCondition,
	searchState,
} from "../../../presentation/store/search-store";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(tagsQueryOptions()),
			context.queryClient.ensureQueryData(allProjectsQueryOptions()),
			context.queryClient.ensureQueryData(allIpsQueryOptions()),
			context.queryClient.ensureQueryData(allCharactersQueryOptions()),
			context.queryClient.ensureQueryData(allAuthorsQueryOptions()),
			context.queryClient.ensureQueryData(mediaSourcesQueryOptions()),
		]);
	},
	component: SourceMediaRoute,
});

function SourceMediaRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;

	const tags = createQuery(() => tagsQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());

	const source = createMemo(() =>
		sources.data?.find((item) => item.id === mediaSourceId()),
	);
	const sourceRootPath = createMemo(() => {
		const current = source();
		if (current?.type !== "local") {
			return undefined;
		}
		const connectionInfo = current.connectionInfo as { path?: string };
		return connectionInfo.path;
	});

	const searchConditionKey = createMemo(() =>
		JSON.stringify(getSearchCondition() ?? null),
	);

	const mediaQuery = createInfiniteQuery<MediaSearchResponse>(() => ({
		queryKey: [
			"media",
			mediaSourceId(),
			searchConditionKey(),
			searchState.sortBy,
			searchState.sortOrder,
		],
		queryFn: ({ pageParam }) =>
			searchMedia(mediaSourceId(), {
				condition: getSearchCondition() || undefined,
				sort: searchState.sortBy,
				order: searchState.sortOrder,
				limit: 100,
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
			return;
		},
		placeholderData: keepPreviousData,
	}));

	useMediaSourceEvents(mediaSourceId, {
		onMediaAdded: () => {
			void mediaQuery.refetch();
		},
		onMediaDeleted: () => {
			void mediaQuery.refetch();
		},
		onMediaChanged: () => {
			void mediaQuery.refetch();
		},
	});

	const mediaResults = createMemo(() => {
		const seen = new Set<string>();
		return (mediaQuery.data?.pages.flatMap((page) => page.media) || []).filter(
			(media) => {
				if (seen.has(media.id)) {
					return false;
				}
				seen.add(media.id);
				return true;
			},
		);
	});

	const handleSearch = () => {
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
				if (entries[0].isIntersecting && mediaQuery.hasNextPage) {
					void mediaQuery.fetchNextPage();
				}
			},
			{ threshold: 0.5, rootMargin: "1000px" },
		);

		observer.observe(element);
		onCleanup(() => observer.disconnect());
	});

	const panel = (
		<SearchControlPanel
			context="source"
			filterData={{
				tags: tags.data,
				projects: allProjects.data,
				ips: allIps.data,
				characters: allCharacters.data,
				authors: allAuthors.data,
			}}
			onSearch={handleSearch}
		/>
	);

	return (
		<main class="container mx-auto p-4">
			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 font-bold text-3xl">
						{source()?.name ?? "Media Source"}
					</h1>
					<p class="text-gray-600">{source()?.description}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						onClick={() =>
							toast.error("Add Media is not implemented in Tauri yet.")
						}
					>
						Add Media
					</Button>
					<Button
						onClick={() =>
							toast.error("Dump JSON is not implemented in Tauri yet.")
						}
						variant="outline"
					>
						Dump JSON
					</Button>
					<Button
						onClick={() =>
							toast.error("Dump ZIP is not implemented in Tauri yet.")
						}
						variant="outline"
					>
						Dump ZIP
					</Button>
					<Button
						onClick={() =>
							toast.error("Restore is not implemented in Tauri yet.")
						}
						variant="outline"
					>
						Restore
					</Button>
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
							{mediaQuery.data?.pages[0]?.total ?? 0} 件の結果
						</p>
					</div>

					<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						<For each={mediaResults()}>
							{(media) => (
								<MediaGridItem
									media={media}
									sourceRootPath={sourceRootPath()}
								/>
							)}
						</For>
					</div>

					<Show when={mediaResults().length === 0 && !mediaQuery.isLoading}>
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
