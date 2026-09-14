import { ClientOnly } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { FilterErrorBanner, QueryStatus } from "../async-state";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { MobileSearchFilterDialog } from "../mobile-search-filter-dialog";
import { SearchControlPanel } from "../search-control-panel";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import { SourceMediaGrid } from "../source-media-grid";
import type { SearchWorkspaceProps } from "./search-screen.types";

export type SearchScreenNavActions = {
	openMobileFilters: () => void;
};

export type SearchScreenProps = SearchWorkspaceProps & {
	renderNavActions?: (actions: SearchScreenNavActions) => JSX.Element;
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

	const renderPanel = () => (
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

	const canRenderContent = () => !props.ssrGuard || isMounted();

	return (
		<div class="container mx-auto p-4">
			<div class="mb-4 flex justify-end">
				{props.renderNavActions?.({ openMobileFilters })}
			</div>
			<ClientOnly>
				<MobileSearchFilterDialog
					context="global"
					filterData={props.filterData}
					onSearch={page().handleSearch}
					onSelectSource={props.onSelectSource}
					open={isMobileFilterOpen()}
					onOpenChange={setIsMobileFilterOpen}
					presetClient={props.presetClient}
					selectedSource={props.selectedSource ?? undefined}
					sources={props.sources}
					usePopover={false}
				/>
			</ClientOnly>

			<div class="mb-6 sm:mb-8">
				<div>
					<h1 class="mb-2 font-bold text-2xl sm:text-3xl">メディア検索</h1>
					<p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
				</div>
			</div>

			<div class="grid min-w-0 gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
				<Card class="sticky top-20 hidden h-[calc(100dvh-13rem)] self-start overflow-y-auto overscroll-contain md:block">
					<CardHeader>
						<CardTitle>検索フィルター</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">{renderPanel()}</CardContent>
				</Card>

				<div class="min-w-0 space-y-4">
					<Show
						when={filterStates().some(
							(state) => state.phase === "error" || state.phase === "offline",
						)}
					>
						<FilterErrorBanner
							message="一部の検索フィルターを取得できませんでした。検索結果は引き続き利用できます。"
							onRetry={page().retryFilters}
						/>
					</Show>
					<QueryStatus
						fetchState={page().contentState().fetchState}
						hasData={page().contentState().data !== undefined}
						offlineLabel="オフラインのため保存済みの検索結果を表示しています"
						updatingLabel="検索結果を更新中..."
					/>
					<Show
						fallback={
							<LoadingRegion label="検索結果を読み込んでいます...">
								<MediaGridSkeleton />
							</LoadingRegion>
						}
						when={canRenderContent()}
					>
						<SourceMediaGrid
							disableContextMenu={!props.onFindSimilar}
							enableVirtualization={props.enableVirtualization}
							errorTitle="検索結果を取得できませんでした"
							isFetchingNextPage={page().searchResultQuery.isFetchingNextPage}
							mediaResults={page().searchResults}
							mediaSourceId={() => undefined}
							onLoadMore={page().fetchNextPage}
							onFindSimilar={props.onFindSimilar}
							onRetry={async () => {
								await page().searchResultQuery.refetch();
							}}
							hasNextPage={page().searchResultQuery.hasNextPage}
							renderItem={(media, options) =>
								props.renderMediaItem(media, options)
							}
							setLoadMoreRef={page().setLoadMoreRef}
							showEmptyState
							showResultCount
							state={page().contentState}
							totalCount={page().totalCount()}
						/>
					</Show>
				</div>
			</div>
		</div>
	);
}
