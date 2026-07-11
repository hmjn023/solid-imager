import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { ClientOnly } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../dialog";
import type {
	SearchPageFilterData,
	UseSearchPageResult,
} from "../hooks/use-search-page";
import type { SourceMediaPagePresetClient } from "../hooks/use-source-media-page";
import { SearchControlPanel } from "../search-control-panel";
import { SourceMediaGrid } from "../source-media-grid";

export type SearchScreenNavActions = {
	openMobileFilters: () => void;
};

export type SearchScreenProps = {
	page: UseSearchPageResult;
	filterData: SearchPageFilterData;
	sources: SafeMediaSource[] | undefined;
	selectedSource: string | null;
	onSelectSource: (id: string) => void;
	presetClient: SourceMediaPagePresetClient;
	renderNavActions?: (actions: SearchScreenNavActions) => JSX.Element;
	renderMediaItem: (media: Media) => JSX.Element;
	ssrGuard?: boolean;
	enableVirtualization?: boolean;
};

export function SearchScreen(props: SearchScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [isMobileFilterOpen, setIsMobileFilterOpen] = createSignal(false);

	onMount(() => {
		setIsMounted(true);
	});

	const page = () => props.page;
	const filterStates = () => [
		page().filterStates.tags(),
		page().filterStates.sources(),
		page().filterStates.projects(),
		page().filterStates.ips(),
		page().filterStates.characters(),
		page().filterStates.authors(),
	];
	const openMobileFilters = () => setIsMobileFilterOpen(true);

	const panel = (
		<SearchControlPanel
			context="global"
			filterData={props.filterData}
			onSearch={page().handleSearch}
			onSelectSource={props.onSelectSource}
			presetClient={props.presetClient}
			selectedSource={props.selectedSource ?? undefined}
			sources={props.sources}
			usePopover={false}
		/>
	);

	const showResults = () => {
		const hasRenderableState =
			page().contentState().phase === "data" ||
			page().contentState().phase === "empty";
		if (props.ssrGuard) {
			return hasRenderableState && isMounted();
		}
		return hasRenderableState;
	};

	return (
		<main class="container mx-auto p-4">
			{props.renderNavActions?.({ openMobileFilters })}
			<ClientOnly>
				<Dialog
					open={isMobileFilterOpen()}
					onOpenChange={setIsMobileFilterOpen}
				>
					<DialogContent class="max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>検索フィルター</DialogTitle>
						</DialogHeader>
						<div class="space-y-4">{panel}</div>
					</DialogContent>
				</Dialog>
			</ClientOnly>

			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 font-bold text-3xl">メディア検索</h1>
					<p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
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
					<Show
						when={filterStates().some(
							(state) => state.phase === "error" || state.phase === "offline",
						)}
					>
						<p class="text-muted-foreground text-sm" role="status">
							一部の検索フィルターを取得できませんでした。検索結果は引き続き利用できます。
						</p>
					</Show>
					<Show
						when={page().contentState().fetchState === "background-fetching"}
					>
						<p class="text-muted-foreground text-sm" role="status">
							検索結果を更新中...
						</p>
					</Show>
					<Show
						when={
							page().contentState().fetchState === "paused" &&
							page().contentState().data !== undefined
						}
					>
						<p class="text-muted-foreground text-sm" role="status">
							オフラインのため保存済みの検索結果を表示しています
						</p>
					</Show>
					<Show
						fallback={
							<div
								class="py-8 text-center"
								role={
									page().contentState().phase === "error" ? "alert" : "status"
								}
							>
								{page().contentState().phase === "offline"
									? "オフラインです。接続後に検索を再開します"
									: page().contentState().phase === "error"
										? "検索結果を取得できませんでした"
										: "読み込み中..."}
							</div>
						}
						when={showResults()}
					>
						<SourceMediaGrid
							disableContextMenu
							enableVirtualization={props.enableVirtualization}
							isError={page().contentState().phase === "error"}
							isFetchingNextPage={page().searchResultQuery.isFetchingNextPage}
							isPending={page().contentState().phase === "pending"}
							mediaResults={page().searchResults}
							mediaSourceId={() => undefined}
							onLoadMore={() => page().searchResultQuery.fetchNextPage()}
							hasNextPage={page().searchResultQuery.hasNextPage}
							queryError={
								page().searchResultQuery.error instanceof Error
									? page().searchResultQuery.error
									: null
							}
							renderItem={(media, _options) => props.renderMediaItem(media)}
							setLoadMoreRef={page().setLoadMoreRef}
							showEmptyState
							showResultCount
							totalCount={page().searchResultQuery.data?.pages[0]?.total}
						/>
					</Show>
				</div>
			</div>
		</main>
	);
}
