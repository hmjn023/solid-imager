import { createSignal, onMount, Show } from "solid-js";
import { FilterErrorBanner, QueryStatus } from "../async-state";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import { SourceMediaGrid } from "../source-media-grid";
import { V2CollectionInspector } from "../v2/collection-inspector";
import { V2SearchToolbar } from "../v2/search-toolbar";
import type { SearchScreenProps } from "./search-screen";

export function V2SearchScreen(props: SearchScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [previewMediaId, setPreviewMediaId] = createSignal<string | null>(null);
	const page = () => props.page;
	const filterStates = () => [
		page().filterStates.tags(),
		page().filterStates.sources(),
		page().filterStates.projects(),
		page().filterStates.ips(),
		page().filterStates.characters(),
		page().filterStates.authors(),
	];
	const sourceName = () =>
		props.sources?.find((source) => source.id === props.selectedSource)?.name ??
		"All media";
	const canRenderContent = () => !props.ssrGuard || isMounted();
	const previewMedia = () =>
		page()
			.searchResults()
			.find((media) => media.id === previewMediaId());
	const previewSourceName = () =>
		props.sources?.find((source) => source.id === previewMedia()?.mediaSourceId)
			?.name;

	onMount(() => setIsMounted(true));

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]">
			<V2SearchToolbar
				context="global"
				filterData={props.filterData}
				itemCount={page().searchResultQuery.data?.pages[0]?.total}
				onSearch={page().handleSearch}
				onSelectSource={props.onSelectSource}
				presetClient={props.presetClient}
				selectedSource={props.selectedSource ?? undefined}
				sourceName={sourceName()}
				sources={props.sources}
			/>

			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 [scrollbar-gutter:stable]"
				data-media-scroll
			>
				<div class="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_clamp(20rem,26vw,26rem)] 2xl:items-start 2xl:gap-4">
					<div class="min-w-0">
						<Show
							when={filterStates().some(
								(state) => state.phase === "error" || state.phase === "offline",
							)}
						>
							<FilterErrorBanner
								class="mb-3"
								message="一部の検索フィルターを取得できませんでした。検索結果は引き続き利用できます。"
								onRetry={page().retryFilters}
							/>
						</Show>
						<QueryStatus
							class="mb-2"
							fetchState={page().contentState().fetchState}
							hasData={page().contentState().data !== undefined}
							hideWhenIdle
							offlineLabel="オフラインのため保存済みの検索結果を表示しています"
							updatingLabel="検索結果を更新中..."
						/>
						<Show
							fallback={
								<LoadingRegion label="検索結果を読み込んでいます...">
									<MediaGridSkeleton aspectRatio="4/3" />
								</LoadingRegion>
							}
							when={canRenderContent()}
						>
							<SourceMediaGrid
								detailBasePath="/v2/sources"
								disableContextMenu
								enableVirtualization={props.enableVirtualization}
								errorTitle="検索結果を取得できませんでした"
								hasNextPage={page().searchResultQuery.hasNextPage}
								isFetchingNextPage={page().searchResultQuery.isFetchingNextPage}
								itemAspectRatio={4 / 3}
								mediaResults={page().searchResults}
								mediaSourceId={() => undefined}
								onLoadMore={() => page().searchResultQuery.fetchNextPage()}
								onRetry={async () => {
									await page().searchResultQuery.refetch();
								}}
								onPreviewSelect={(media) => setPreviewMediaId(media.id)}
								previewSelectedMediaId={previewMediaId}
								renderItem={(media, options) =>
									props.renderMediaItem(media, options)
								}
								setLoadMoreRef={page().setLoadMoreRef}
								showEmptyState
								showResultCount={false}
								scrollMode="element"
								state={page().contentState}
								totalCount={page().searchResultQuery.data?.pages[0]?.total}
							/>
						</Show>
					</div>
					<Show when={props.renderMediaPreview}>
						{(renderPreview) => (
							<V2CollectionInspector
								media={previewMedia()}
								onOpenDetail={props.onOpenMediaDetail}
								renderPreview={renderPreview()}
								sourceName={previewSourceName()}
							/>
						)}
					</Show>
				</div>
			</div>
		</section>
	);
}
