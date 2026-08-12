import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createSignal, onMount, Show } from "solid-js";
import { FilterErrorBanner, QueryStatus } from "../async-state";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import {
	SourceMediaGrid,
	type SourceMediaViewMode,
} from "../source-media-grid";
import { V2CollectionInspector } from "../v2/collection-inspector";
import { V2SearchToolbar } from "../v2/search-toolbar";
import type { SearchWorkspaceProps } from "./search-screen.types";

export type V2SearchScreenProps = SearchWorkspaceProps & {
	onOpenMediaDetail?: (media: Media, context?: Media[]) => void;
	onPrepareMediaDetail?: (media: Media, context?: Media[]) => void;
	renderMediaPreview?: (media: Media) => import("solid-js").JSX.Element;
};

export function V2SearchScreen(props: V2SearchScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [previewMediaId, setPreviewMediaId] = createSignal<string | null>(null);
	const [viewMode, setViewMode] = createSignal<SourceMediaViewMode>("grid");
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
		"すべてのメディア";
	const canRenderContent = () => !props.ssrGuard || isMounted();
	const previewMedia = () =>
		page()
			.searchResults()
			.find((media) => media.id === previewMediaId());
	const previewSourceName = () =>
		props.sources?.find((source) => source.id === previewMedia()?.mediaSourceId)
			?.name;
	const openMediaDetail = (media: Media) =>
		props.onOpenMediaDetail?.(media, page().searchResults());

	onMount(() => setIsMounted(true));

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]">
			<V2SearchToolbar
				context="global"
				filterData={props.filterData}
				itemCount={page().totalCount()}
				onSearch={page().handleSearch}
				onSelectSource={props.onSelectSource}
				presetClient={props.presetClient}
				selectedSource={props.selectedSource ?? undefined}
				sourceName={sourceName()}
				sources={props.sources}
				onViewModeChange={setViewMode}
				viewMode={viewMode()}
			/>
			<div class="shrink-0 px-3 pt-3 sm:px-4">
				<Show
					when={filterStates().some(
						(state) => state.phase === "error" || state.phase === "offline",
					)}
				>
					<FilterErrorBanner
						class="mb-2"
						message="一部の検索フィルターを取得できませんでした。検索結果は引き続き利用できます。"
						onRetry={page().retryFilters}
					/>
				</Show>
				<div class="h-8">
					<QueryStatus
						fetchState={page().contentState().fetchState}
						hasData={page().contentState().data !== undefined}
						hideWhenIdle
						offlineLabel="オフラインのため保存済みの検索結果を表示しています"
						updatingLabel="検索結果を更新中..."
					/>
				</div>
			</div>

			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 [scrollbar-gutter:stable]"
				data-media-scroll="v2-search"
			>
				<div class="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_clamp(20rem,26vw,26rem)] 2xl:items-start 2xl:gap-4">
					<div class="min-w-0">
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
								onOpenMediaDetail={openMediaDetail}
								onPrepareMediaDetail={(media) =>
									props.onPrepareMediaDetail?.(media, page().searchResults())
								}
								onLoadMore={page().fetchNextPage}
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
								totalCount={page().totalCount()}
								viewMode={viewMode}
							/>
						</Show>
					</div>
					<Show when={props.renderMediaPreview}>
						{(renderPreview) => (
							<Show when={previewMedia()}>
								{(media) => (
									<V2CollectionInspector
										media={media()}
										onOpenDetail={openMediaDetail}
										renderPreview={renderPreview()}
										sourceName={previewSourceName()}
									/>
								)}
							</Show>
						)}
					</Show>
				</div>
			</div>
		</section>
	);
}
