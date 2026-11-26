import { useRenderedSearchState } from "../search-initial-state";
import { t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import { createSignal, onSettled, Show, useContext } from "solid-js";
import { EmptyState, FilterErrorBanner, QueryStatus } from "../async-state";
import { Button } from "../button";
import type { SearchWorkspaceController } from "../hooks/use-search-workspace";
import type { MediaCollectionSelectionMode } from "../hooks/use-media-collection-selection";
import { ListSkeleton, LoadingRegion, MediaGridSkeleton } from "../skeleton";
import {
	SourceMediaGrid,
	type SourceMediaViewMode,
} from "../source-media-grid";
import {
	clearPresetFilters,
	hasSearchConditions,
} from "../stores/search-store";
import { readUiStorageValue, UI_STORAGE_KEYS } from "../ui-storage";
import { AddSourceContext } from "../workspace/add-source-context";
import { CollectionBulkActions } from "../workspace/collection-bulk-actions";
import {
	CollectionInspector,
	createCollectionInspector,
} from "../workspace/collection-inspector";
import { Database, Library, Plus } from "../workspace/icons";
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
				onEnterBulkSelectMode={actions.enterBulkSelection}
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
	onEnterBulkSelectMode?: () => void;
	onOpenMediaDetail?: (media: Media, context?: Media[]) => void;
	onPrepareMediaDetail?: (media: Media, context?: Media[]) => void;
	onSelectAll?: () => void;
	onSelectMedia?: (mediaId: string, mode: MediaCollectionSelectionMode) => void;
	onToggleSelect?: (mediaId: string) => void;
	onVisibleMediaIdsChange?: (mediaIds: readonly string[]) => void;
	renderMediaPreview?: (media: Media) => import("@solidjs/web").JSX.Element;
	selectedCount?: () => number;
};

export function SearchScreen(props: SearchScreenProps) {
	const searchState = useRenderedSearchState();
	const addSource = useContext(AddSourceContext) ?? undefined;
	const [isMounted, setIsMounted] = createSignal(false);
	const [viewMode, setViewMode] = createSignal<SourceMediaViewMode>("grid");
	const page = () => props.page;
	const inspector = createCollectionInspector({
		enabled: () => Boolean(props.renderMediaPreview),
		media: () => page().searchResults(),
		phase: () => page().contentState().phase,
	});
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
	const canRenderContent = () =>
		!props.ssrGuard || isMounted() || page().hasData();
	const noSources = () => {
		const state = page().filterStates.sources();
		return (
			state.phase === "empty" && state.fetchState === "idle" && !state.error
		);
	};
	const isUnfiltered = () =>
		page().resultsCurrent() &&
		!props.selectedSource &&
		!hasSearchConditions(searchState());
	const clearSearch = () => {
		clearPresetFilters();
		page().handleSearch();
	};
	const previewSourceName = () =>
		props.sources?.find(
			(source) => source.id === inspector.media()?.mediaSourceId,
		)?.name;
	const openMediaDetail = (media: Media) =>
		props.onOpenMediaDetail?.(media, page().searchResults());
	const updateViewMode = (mode: SourceMediaViewMode) => {
		setViewMode(mode);
		try {
			localStorage.setItem(UI_STORAGE_KEYS.searchViewMode, mode);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	};
	createTrackedEffect(() => {
		props.onVisibleMediaIdsChange?.(
			page()
				.searchResults()
				.map((media) => media.id),
		);
	});

	onSettled(() => {
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
				bulkSelection={
					props.onEnterBulkSelectMode && page().searchResults().length > 0
						? {
								active: props.isBulkSelectMode?.() ?? false,
								onEnter: props.onEnterBulkSelectMode,
								onClear: props.onClearSelection,
							}
						: undefined
				}
				context="global"
				filterData={props.filterData}
				inspectorToggle={
					inspector.canToggle()
						? { isOpen: inspector.isOpen(), onToggle: inspector.toggle }
						: undefined
				}
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

			<div class="flex min-h-0 flex-1 overflow-hidden">
				<div
					class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 scrollbar-stable"
					data-media-scroll="search"
				>
					<Show
						fallback={
							<LoadingRegion label={t("searchScreen.loadingSearchResults")}>
								<Show
									fallback={<MediaGridSkeleton aspectRatio="4/3" />}
									when={viewMode() === "list"}
								>
									<ListSkeleton />
								</Show>
							</LoadingRegion>
						}
						when={canRenderContent()}
					>
						<SourceMediaGrid
							detailBasePath={props.detailBasePath}
							emptyState={
								isUnfiltered() ? (
									<Show
										when={noSources()}
										fallback={
											<EmptyState
												description={t("searchScreen.openSourceToAddMedia")}
												icon={<Library size={20} />}
												title={t("searchScreen.libraryIsEmpty")}
											/>
										}
									>
										<EmptyState
											description={t("searchScreen.addSourceToLibrary")}
											icon={<Database size={20} />}
											title={t("sourceList.noSourcesYet")}
										>
											<Show when={addSource}>
												<Button onClick={addSource}>
													<Plus size={16} />
													{t("actions.addSource")}
												</Button>
											</Show>
										</EmptyState>
									</Show>
								) : undefined
							}
							enableVirtualization={props.enableVirtualization}
							errorTitle={t("searchScreen.couldNotLoadSearchResults")}
							hasNextPage={page().searchResultQuery.hasNextPage}
							isFetchingNextPage={page().isFetchingNextPage()}
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
							onClearSearch={
								page().resultsCurrent() && hasSearchConditions(searchState())
									? clearSearch
									: undefined
							}
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
							onPreviewSelect={inspector.previewSelection()}
							previewSelectedMediaId={inspector.previewId}
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
				<Show when={props.renderMediaPreview && inspector.isVisible()}>
					{(() => {
						const renderPreview = props.renderMediaPreview;
						return renderPreview ? (
							<div class="hidden h-full min-h-0 w-96 shrink-0 py-3 pr-4 2xl:block">
								<CollectionInspector
									media={inspector.media()}
									onClose={inspector.close}
									onOpenDetail={
										props.onOpenMediaDetail ? openMediaDetail : undefined
									}
									renderPreview={renderPreview}
									sourceName={previewSourceName()}
								/>
							</div>
						) : null;
					})()}
				</Show>
			</div>
			<Show
				when={props.isBulkSelectMode?.() && page().searchResults().length > 0}
			>
				<CollectionBulkActions
					loadedCount={page().searchResults().length}
					selectedCount={props.selectedCount?.() ?? 0}
					onSelectAll={props.onSelectAll}
					onBulkAction={props.onBulkAction}
					onClearSelection={props.onClearSelection}
					testId="search-bulk-actions-bar"
				/>
			</Show>
		</section>
	);
}

import { createTrackedEffect } from "solid-js";
