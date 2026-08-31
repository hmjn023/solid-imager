import type { Media } from "@solid-imager/core/domain/media/schemas";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import { FilterErrorBanner, QueryStatus } from "../async-state";
import { Button } from "../button";
import type { MediaCollectionSelectionMode } from "../hooks/use-media-collection-selection";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import {
	SourceMediaGrid,
	type SourceMediaViewMode,
} from "../source-media-grid";
import { V2CollectionInspector } from "../v2/collection-inspector";
import { reconcileCollectionPreviewId } from "../v2/collection-navigation";
import { V2SearchToolbar } from "../v2/search-toolbar";
import type { SearchWorkspaceProps } from "./search-screen.types";

export type V2SearchScreenProps = SearchWorkspaceProps & {
	isBulkSelectMode?: () => boolean;
	isSelected?: (mediaId: string) => boolean;
	onBulkAction?: () => void;
	onClearSelection?: () => void;
	onCopyMove?: (mediaId: string, mode: "copy" | "move") => void;
	onDelete?: (mediaId: string) => void;
	onOpenMediaDetail?: (media: Media, context?: Media[]) => void;
	onPrepareMediaDetail?: (media: Media, context?: Media[]) => void;
	onSelectAll?: () => void;
	onSelectMedia?: (mediaId: string, mode: MediaCollectionSelectionMode) => void;
	onToggleSelect?: (mediaId: string) => void;
	onVisibleMediaIdsChange?: (mediaIds: readonly string[]) => void;
	renderMediaPreview?: (media: Media) => import("solid-js").JSX.Element;
	selectedCount?: () => number;
};

const V2_SEARCH_VIEW_MODE_KEY = "solid-imager:v2:search:view-mode";

export function V2SearchScreen(props: V2SearchScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [previewMediaId, setPreviewMediaId] = createSignal<string | null>(null);
	const [isInspectorVisible, setIsInspectorVisible] = createSignal(true);
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
	const hasFilterError = () =>
		filterStates().some(
			(state) => state.phase === "error" || state.phase === "offline",
		);
	const hasContentStatus = () => {
		const state = page().contentState();
		return (
			state.fetchState === "background-fetching" ||
			(state.fetchState === "paused" && state.data !== undefined)
		);
	};
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
	const selectPreviewMedia = (media: Media) => {
		setPreviewMediaId(media.id);
		setIsInspectorVisible(true);
	};
	const updateViewMode = (mode: SourceMediaViewMode) => {
		setViewMode(mode);
		try {
			localStorage.setItem(V2_SEARCH_VIEW_MODE_KEY, mode);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	};
	createEffect(() => {
		props.onVisibleMediaIdsChange?.(
			page()
				.searchResults()
				.map((media) => media.id),
		);
	});

	createEffect(() => {
		const nextId = props.renderMediaPreview
			? reconcileCollectionPreviewId(page().searchResults(), previewMediaId())
			: null;
		if (nextId !== previewMediaId()) setPreviewMediaId(nextId);
	});

	onMount(() => {
		setIsMounted(true);
		try {
			const storedMode = localStorage.getItem(V2_SEARCH_VIEW_MODE_KEY);
			if (storedMode === "grid" || storedMode === "list") {
				setViewMode(storedMode);
			}
		} catch {
			// Keep the SSR-safe default when storage cannot be read.
		}
	});

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
				onViewModeChange={updateViewMode}
				viewMode={viewMode()}
			/>
			<Show when={hasFilterError() || hasContentStatus()}>
				<div class="shrink-0 px-3 pt-3 sm:px-4">
					<Show when={hasFilterError()}>
						<FilterErrorBanner
							class="mb-2"
							message="一部の検索フィルターを取得できませんでした。検索結果は引き続き利用できます。"
							onRetry={page().retryFilters}
						/>
					</Show>
					<QueryStatus
						fetchState={page().contentState().fetchState}
						hasData={page().contentState().data !== undefined}
						hideWhenIdle
						offlineLabel="オフラインのため保存済みの検索結果を表示しています"
						updatingLabel="検索結果を更新中..."
					/>
				</div>
			</Show>

			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 [scrollbar-gutter:stable]"
				data-media-scroll="v2-search"
			>
				<div
					class={
						props.renderMediaPreview && isInspectorVisible()
							? "2xl:grid 2xl:grid-cols-[minmax(0,1fr)_clamp(20rem,26vw,26rem)] 2xl:items-start 2xl:gap-4"
							: "2xl:grid 2xl:grid-cols-[minmax(0,1fr)] 2xl:items-start"
					}
				>
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
								enableVirtualization={props.enableVirtualization}
								errorTitle="検索結果を取得できませんでした"
								hasNextPage={page().searchResultQuery.hasNextPage}
								isFetchingNextPage={page().searchResultQuery.isFetchingNextPage}
								itemAspectRatio={4 / 3}
								isBulkSelectMode={props.isBulkSelectMode}
								isSelected={props.isSelected}
								mediaResults={page().searchResults}
								mediaSourceId={() => undefined}
								onBulkAction={props.onBulkAction}
								onClearSelection={props.onClearSelection}
								onCopyMove={props.onCopyMove}
								onDelete={props.onDelete}
								onOpenMediaDetail={
									props.onOpenMediaDetail ? openMediaDetail : undefined
								}
								onPrepareMediaDetail={(media) =>
									props.onPrepareMediaDetail?.(media, page().searchResults())
								}
								onLoadMore={page().fetchNextPage}
								onRetry={async () => {
									await page().searchResultQuery.refetch();
								}}
								onSelectMedia={props.onSelectMedia}
								onToggleSelect={props.onToggleSelect}
								selectedCount={props.selectedCount}
								onPreviewSelect={
									props.renderMediaPreview ? selectPreviewMedia : undefined
								}
								previewSelectedMediaId={
									props.renderMediaPreview ? previewMediaId : undefined
								}
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
							<Show when={isInspectorVisible()}>
								<V2CollectionInspector
									media={previewMedia()}
									onClose={() => setIsInspectorVisible(false)}
									onOpenDetail={
										props.onOpenMediaDetail ? openMediaDetail : undefined
									}
									renderPreview={renderPreview()}
									sourceName={previewSourceName()}
								/>
							</Show>
						)}
					</Show>
				</div>
			</div>
			<Show when={props.isBulkSelectMode?.()}>
				<div
					class="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 py-3 shadow-lg sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:w-auto sm:max-w-none sm:flex-nowrap sm:gap-3 sm:px-4"
					data-testid="search-bulk-actions-bar"
				>
					<span class="w-full text-center font-medium text-sm sm:w-auto">
						{props.selectedCount?.() ?? 0} 件選択中
					</span>
					<Button
						class="flex-1 sm:flex-none"
						disabled={
							page().searchResults().length === 0 ||
							(props.selectedCount?.() ?? 0) === page().searchResults().length
						}
						onClick={props.onSelectAll}
						variant="outline"
					>
						表示分をすべて選択
					</Button>
					<Show when={props.onBulkAction}>
						<Button
							class="flex-1 sm:flex-none"
							disabled={(props.selectedCount?.() ?? 0) === 0}
							onClick={props.onBulkAction}
						>
							一括操作を実行
						</Button>
					</Show>
					<Button
						class="flex-1 sm:flex-none"
						onClick={props.onClearSelection}
						variant="outline"
					>
						解除
					</Button>
				</div>
			</Show>
		</section>
	);
}
