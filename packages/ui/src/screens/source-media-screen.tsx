import { t } from "@solid-imager/i18n";
import Upload from "lucide-solid/icons/upload";
import { createSignal, onMount, Show } from "solid-js";
import { EmptyState, FilterErrorBanner, QueryStatus } from "../async-state";
import { Button } from "../button";
import { MediaDeleteDialog } from "../media-delete-dialog";
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
import { CollectionBulkActions } from "../workspace/collection-bulk-actions";
import {
	CollectionInspector,
	createCollectionInspector,
} from "../workspace/collection-inspector";
import { Image } from "../workspace/icons";
import { SearchToolbar } from "../workspace/search-toolbar";
import type { SourceMediaScreenProps } from "./source-media-screen.types";

/** Renders a source collection with search, upload, preview, and optional virtualized results. */
export function SourceMediaScreen(props: SourceMediaScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [viewMode, setViewMode] = createSignal<SourceMediaViewMode>("grid");
	const page = () => props.page;
	const inspector = createCollectionInspector({
		enabled: () => Boolean(props.renderMediaPreview),
		media: () => page().mediaResults(),
		phase: () => page().contentState().phase,
	});
	const filterStates = () => Object.values(page().filterStates());
	const hasFilterError = () =>
		filterStates().some(
			(state) => state.phase === "error" || state.phase === "offline",
		);
	const hasOfflineStatus = () => {
		const state = page().contentState();
		return state.fetchState === "paused" && state.data !== undefined;
	};
	const shouldRenderGrid = () => !props.enableVirtualization || isMounted();
	const showEmptySource = () =>
		shouldRenderGrid() &&
		page().contentState().phase === "empty" &&
		!page().mediaQuery.isPlaceholderData &&
		!hasSearchConditions();
	const clearSearch = () => {
		clearPresetFilters();
		page().handleSearch();
	};
	const openMediaDetail = (media: import("@solid-imager/core/media").Media) =>
		props.onOpenMediaDetail?.(media, page().mediaResults());
	const prepareMediaDetail = (
		media: import("@solid-imager/core/media").Media,
	) => props.onPrepareMediaDetail?.(media, page().mediaResults());
	const updateViewMode = (mode: SourceMediaViewMode) => {
		setViewMode(mode);
		try {
			localStorage.setItem(UI_STORAGE_KEYS.sourceViewMode, mode);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	};

	onMount(() => {
		setIsMounted(true);
		try {
			const storedMode = readUiStorageValue(
				localStorage,
				UI_STORAGE_KEYS.sourceViewMode,
			);
			if (storedMode === "grid" || storedMode === "list") {
				setViewMode(storedMode);
			}
		} catch {
			// Keep the SSR-safe default when storage cannot be read.
		}
	});

	return (
		<section
			aria-label={t("sourceMediaScreen.mediaUploadArea")}
			class="flex h-full min-h-0 min-w-0 flex-col bg-background"
			onDragOver={page().handleDragOver}
			onDrop={page().handleDrop}
		>
			<SearchToolbar
				actions={
					<Show when={!showEmptySource()}>
						<div class="flex flex-wrap gap-2">
							<Button
								class="min-h-11 sm:min-h-9"
								disabled={
									page().isSyncingMedia() || page().mediaResults().length === 0
								}
								onClick={() => {
									void page().handleSyncLoadedMedia();
								}}
								size="sm"
								variant="outline"
							>
								{page().isSyncingMedia()
									? t("status.syncing")
									: t("sourceMediaScreen.syncLoadedItems")}
							</Button>
							<Button
								class="min-h-11 sm:min-h-9"
								onClick={page().handleAddButtonClick}
								size="sm"
							>
								<Upload aria-hidden="true" size={15} />
								{t("actions.add")}
							</Button>
						</div>
					</Show>
				}
				bulkSelection={
					props.onEnterBulkSelectMode &&
					(page().mediaResults().length > 0 || props.isBulkSelectMode?.())
						? {
								active: props.isBulkSelectMode?.() ?? false,
								onEnter: props.onEnterBulkSelectMode,
								onClear: props.onClearSelection,
							}
						: undefined
				}
				context="source"
				filterData={page().filterData()}
				inspectorToggle={
					inspector.canToggle()
						? { isOpen: inspector.isOpen(), onToggle: inspector.toggle }
						: undefined
				}
				itemCount={page().totalCount()}
				isUpdating={page().contentState().fetchState === "background-fetching"}
				onSearch={page().handleSearch}
				presetClient={page().presetClient}
				sourceName={
					props.mediaSourceName?.() ?? t("sourceMediaScreen.mediaList")
				}
				updatingLabel={t("sourceMediaScreen.updatingMediaList")}
				onViewModeChange={updateViewMode}
				viewMode={viewMode()}
			/>

			<Show when={props.renderJobProgress && page().jobProgress()}>
				{props.renderJobProgress?.({ jobProgress: page().jobProgress })}
			</Show>
			<Show when={hasFilterError() || hasOfflineStatus()}>
				<div class="shrink-0 px-3 pt-3 sm:px-4">
					<Show when={hasFilterError()}>
						<FilterErrorBanner
							class="mb-2"
							message={t(
								"sourceMediaScreen.someSearchFiltersCouldNotBeLoadedYouCan",
							)}
							onRetry={props.onRetryFilters}
						/>
					</Show>
					<Show when={hasOfflineStatus()}>
						<QueryStatus
							fetchState={page().contentState().fetchState}
							hasData={page().contentState().data !== undefined}
							hideWhenIdle
							offlineLabel={t("sourceMediaScreen.offlineShowingSavedData")}
							updatingLabel={t("sourceMediaScreen.updatingMediaList")}
						/>
					</Show>
				</div>
			</Show>

			<div class="flex min-h-0 flex-1 overflow-hidden">
				<div
					class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 scrollbar-stable"
					data-media-scroll={page().mediaSourceId() ?? "source-media"}
				>
					<Show
						fallback={
							<LoadingRegion label={t("sourceMediaScreen.loadingMediaList")}>
								<Show
									fallback={<MediaGridSkeleton aspectRatio="4/3" />}
									when={viewMode() === "list"}
								>
									<ListSkeleton />
								</Show>
							</LoadingRegion>
						}
						when={shouldRenderGrid()}
					>
						<SourceMediaGrid
							contextMenuMediaId={page().contextMenuMediaId}
							detailBasePath={props.detailBasePath}
							emptyState={
								showEmptySource() ? (
									<EmptyState
										description={t("sourceMediaScreen.addOrDropMedia")}
										icon={<Image size={20} />}
										title={t("sourceMediaScreen.noMediaYet")}
									>
										<Button onClick={page().handleAddButtonClick}>
											<Upload aria-hidden="true" size={16} />
											{t("actions.add")}
										</Button>
									</EmptyState>
								) : undefined
							}
							enableVirtualization={props.enableVirtualization}
							hasNextPage={page().mediaQuery.hasNextPage}
							isBulkSelectMode={props.isBulkSelectMode}
							isFetchingNextPage={page().mediaQuery.isFetchingNextPage}
							isFetchNextPageError={page().mediaQuery.isFetchNextPageError}
							itemAspectRatio={4 / 3}
							isSelected={props.isSelected}
							mediaResults={page().mediaResults}
							mediaSourceId={page().mediaSourceId}
							onOpenMediaDetail={
								props.onOpenMediaDetail ? openMediaDetail : undefined
							}
							onPrepareMediaDetail={prepareMediaDetail}
							onBulkAction={props.onBulkAction}
							onClearSelection={props.onClearSelection}
							onClearSearch={
								!page().mediaQuery.isPlaceholderData && hasSearchConditions()
									? clearSearch
									: undefined
							}
							onCopyMove={page().handleCopyMove}
							onDelete={page().handleDelete}
							onFindSimilar={props.onFindSimilar}
							onLoadMore={() => {
								void page().fetchNextPage();
							}}
							onPreviewSelect={inspector.previewSelection()}
							onRetry={async () => {
								await page().mediaQuery.refetch();
							}}
							onSelectMedia={props.onSelectMedia}
							onSyncSingleMedia={(mediaId) => {
								void page().handleSyncSingleMedia(mediaId);
							}}
							onToggleSelect={props.onToggleSelect}
							renderItem={props.renderItem}
							previewSelectedMediaId={inspector.previewId}
							selectedCount={props.selectedCount}
							setContextMenuMediaId={page().setContextMenuMediaId}
							setLoadMoreRef={page().setLoadMoreRef}
							showOpenInNewTab={props.showOpenInNewTab}
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
									sourceName={props.mediaSourceName?.()}
								/>
							</div>
						) : null;
					})()}
				</Show>
			</div>
			<Show when={props.isBulkSelectMode?.()}>
				<CollectionBulkActions
					loadedCount={page().mediaResults().length}
					selectedCount={props.selectedCount?.() ?? 0}
					onSelectAll={props.onSelectAll}
					onBulkAction={props.onBulkAction}
					onClearSelection={props.onClearSelection}
					testId="bulk-actions-bar"
				/>
			</Show>

			<input
				accept="image/*,video/*,audio/*,.json"
				class="hidden"
				multiple
				onChange={(event) => {
					void page().handleFileSelect(event);
				}}
				ref={page().setFileInputRef}
				type="file"
			/>

			{(() => {
				const UploadModal = props.uploadModalComponent;
				return (
					<UploadModal
						sourceId={page().mediaSourceId()}
						initialFile={page().fileToUpload()}
						initialFiles={page().filesToUpload()}
						isOpen={page().showUploadModal()}
						onClose={() => {
							page().setShowUploadModal(false);
							page().setPastedUrl(null);
							page().setFilesToUpload([]);
						}}
						onUpload={page().handleUpload}
						pastedUrl={page().pastedUrl()}
					/>
				);
			})()}

			<MediaDeleteDialog
				open={page().deleteDialogOpen()}
				fileName={page().deleteFileName()}
				isSubmitting={page().isDeletingMedia()}
				error={page().deleteError()}
				onOpenChange={page().setDeleteDialogOpen}
				onConfirm={page().confirmDelete}
			/>

			{(() => {
				const MoveCopyDialog = props.moveCopyDialogComponent;
				return (
					<MoveCopyDialog
						currentSourceId={page().moveCopySourceId() ?? ""}
						mode={page().moveCopyMode()}
						onConfirm={page().handleConfirmCopyMove}
						onOpenChange={page().setMoveCopyDialogOpen}
						open={page().moveCopyDialogOpen()}
						isSubmitting={page().isMoveCopySubmitting()}
						error={page().moveCopyError()}
					/>
				);
			})()}
		</section>
	);
}
