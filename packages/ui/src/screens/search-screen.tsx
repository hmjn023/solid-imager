import { t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import { FilterErrorBanner, QueryStatus } from "../async-state";
import { Button } from "../button";
import type { SearchWorkspaceController } from "../hooks/use-search-workspace";
import type { MediaCollectionSelectionMode } from "../hooks/use-media-collection-selection";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import {
	SourceMediaGrid,
	type SourceMediaViewMode,
} from "../source-media-grid";
import { readUiStorageValue, UI_STORAGE_KEYS } from "../ui-storage";
import { CollectionInspector } from "../workspace/collection-inspector";
import { reconcileCollectionPreviewId } from "../workspace/collection-navigation";
import { SearchToolbar } from "../workspace/search-toolbar";
import type { SearchWorkspaceProps } from "./search-screen.types";
import {
	SearchActionDialogs,
	type SearchBulkOperations,
} from "./search-action-dialogs";

type SearchWorkspaceComponentProps = Pick<
	SearchScreenProps,
	| "detailBasePath"
	| "onOpenMediaDetail"
	| "onPrepareMediaDetail"
	| "presetClient"
	| "renderMediaItem"
	| "renderMediaPreview"
> & {
	controller: SearchWorkspaceController;
	operations: SearchBulkOperations;
};

/** Connects the shared controller to the collection screen and its dialogs. */
export function SearchWorkspace(props: SearchWorkspaceComponentProps) {
	const { page, actions } = props.controller;
	return (
		<>
			<SearchScreen
				enableVirtualization
				ssrGuard
				page={page}
				filterData={page.filterData}
				sources={page.sources()}
				selectedSource={props.controller.selectedSource()}
				onSelectSource={props.controller.selectSource}
				onFindSimilar={props.controller.findSimilar}
				isBulkSelectMode={actions.isBulkSelectMode}
				isSelected={actions.selection.isSelected}
				selectedCount={() => actions.selection.selectedIds().size}
				onBulkAction={() => actions.changeBulkActionOpen(true)}
				onClearSelection={actions.clearSelection}
				onCopyMove={actions.openCopyMove}
				onDelete={actions.openDelete}
				onSelectAll={actions.selectAll}
				onSelectMedia={actions.selectMedia}
				onToggleSelect={(id) => actions.selectMedia(id, "toggle")}
				detailBasePath={props.detailBasePath}
				onOpenMediaDetail={props.onOpenMediaDetail}
				onPrepareMediaDetail={props.onPrepareMediaDetail}
				presetClient={props.presetClient}
				renderMediaItem={props.renderMediaItem}
				renderMediaPreview={props.renderMediaPreview}
			/>
			<SearchActionDialogs actions={actions} operations={props.operations} />
		</>
	);
}

export type SearchScreenProps = SearchWorkspaceProps & {
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

export function SearchScreen(props: SearchScreenProps) {
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
	const hasOfflineStatus = () => {
		const state = page().contentState();
		return state.fetchState === "paused" && state.data !== undefined;
	};
	const sourceName = () =>
		props.sources?.find((source) => source.id === props.selectedSource)?.name ??
		t("searchScreen.allMedia");
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
			localStorage.setItem(UI_STORAGE_KEYS.searchViewMode, mode);
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
			const storedMode = readUiStorageValue(
				localStorage,
				UI_STORAGE_KEYS.searchViewMode,
			);
			if (storedMode === "grid" || storedMode === "list") {
				setViewMode(storedMode);
			}
		} catch {
			// Keep the SSR-safe default when storage cannot be read.
		}
	});

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-background">
			<SearchToolbar
				context="global"
				filterData={props.filterData}
				itemCount={page().totalCount()}
				isUpdating={page().contentState().fetchState === "background-fetching"}
				onSearch={page().handleSearch}
				onSelectSource={props.onSelectSource}
				presetClient={props.presetClient}
				selectedSource={props.selectedSource ?? undefined}
				sourceName={sourceName()}
				sources={props.sources}
				updatingLabel={t("searchScreen.updatingSearchResults")}
				onViewModeChange={updateViewMode}
				viewMode={viewMode()}
			/>
			<Show when={hasFilterError() || hasOfflineStatus()}>
				<div class="shrink-0 px-3 pt-3 sm:px-4">
					<Show when={hasFilterError()}>
						<FilterErrorBanner
							class="mb-2"
							message={t(
								"searchScreen.someSearchFiltersCouldNotBeLoadedYouCan",
							)}
							onRetry={page().retryFilters}
						/>
					</Show>
					<Show when={hasOfflineStatus()}>
						<QueryStatus
							fetchState={page().contentState().fetchState}
							hasData={page().contentState().data !== undefined}
							hideWhenIdle
							offlineLabel={t("searchScreen.offlineShowingSavedSearchResults")}
							updatingLabel={t("searchScreen.updatingSearchResults")}
						/>
					</Show>
				</div>
			</Show>

			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 scrollbar-stable"
				data-media-scroll="search"
			>
				<div
					class={
						props.renderMediaPreview && isInspectorVisible()
							? "2xl:grid 2xl:grid-cols-workspace-sidebar 2xl:items-start 2xl:gap-4"
							: "2xl:grid 2xl:grid-cols-1 2xl:items-start"
					}
				>
					<div class="min-w-0">
						<Show
							fallback={
								<LoadingRegion label={t("searchScreen.loadingSearchResults")}>
									<MediaGridSkeleton aspectRatio="4/3" />
								</LoadingRegion>
							}
							when={canRenderContent()}
						>
							<SourceMediaGrid
								detailBasePath={props.detailBasePath}
								enableVirtualization={props.enableVirtualization}
								errorTitle={t("searchScreen.couldNotLoadSearchResults")}
								hasNextPage={page().searchResultQuery.hasNextPage}
								isFetchingNextPage={page().searchResultQuery.isFetchingNextPage}
								isFetchNextPageError={
									page().searchResultQuery.isFetchNextPageError
								}
								itemAspectRatio={4 / 3}
								isBulkSelectMode={props.isBulkSelectMode}
								isSelected={props.isSelected}
								mediaResults={page().searchResults}
								mediaSourceId={() => undefined}
								onBulkAction={props.onBulkAction}
								onClearSelection={props.onClearSelection}
								onCopyMove={props.onCopyMove}
								onDelete={props.onDelete}
								onFindSimilar={props.onFindSimilar}
								onOpenMediaDetail={
									props.onOpenMediaDetail ? openMediaDetail : undefined
								}
								onPrepareMediaDetail={(media) =>
									props.onPrepareMediaDetail?.(media, page().searchResults())
								}
								onLoadMore={() => {
									void page().fetchNextPage();
								}}
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
								<CollectionInspector
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
					class="fixed bottom-safe left-1/2 z-40 flex w-dialog-inset max-w-md -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-3 shadow-lg sm:bottom-safe-sm sm:w-auto sm:max-w-none sm:flex-nowrap sm:gap-3 sm:px-4"
					data-testid="search-bulk-actions-bar"
				>
					<span class="w-full text-center font-medium text-sm sm:w-auto">
						{t("searchScreen.valueSelected", {
							value0: String(props.selectedCount?.() ?? 0),
						})}
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
						{t("searchScreen.selectAllLoadedItems")}
					</Button>
					<Show when={props.onBulkAction}>
						<Button
							class="flex-1 sm:flex-none"
							disabled={(props.selectedCount?.() ?? 0) === 0}
							onClick={props.onBulkAction}
						>
							{t("searchScreen.runBulkAction")}
						</Button>
					</Show>
					<Button
						class="flex-1 sm:flex-none"
						onClick={props.onClearSelection}
						variant="outline"
					>
						{t("actions.clearSelection")}
					</Button>
				</div>
			</Show>
		</section>
	);
}
