import Upload from "lucide-solid/icons/upload";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import { FilterErrorBanner, QueryStatus } from "../async-state";
import { Button } from "../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import {
	SourceMediaGrid,
	type SourceMediaViewMode,
} from "../source-media-grid";
import { V2CollectionInspector } from "../v2/collection-inspector";
import { reconcileCollectionPreviewId } from "../v2/collection-navigation";
import { V2SearchToolbar } from "../v2/search-toolbar";
import type { SourceMediaScreenProps } from "./source-media-screen.types";

const V2_SOURCE_VIEW_MODE_KEY = "solid-imager:v2:source-media:view-mode";

export function V2SourceMediaScreen(props: SourceMediaScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [previewMediaId, setPreviewMediaId] = createSignal<string | null>(null);
	const [isInspectorVisible, setIsInspectorVisible] = createSignal(true);
	const [viewMode, setViewMode] = createSignal<SourceMediaViewMode>("grid");
	const page = () => props.page;
	const filterStates = () => Object.values(page().filterStates());
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
	const shouldRenderGrid = () => !props.enableVirtualization || isMounted();
	const previewMedia = () =>
		page()
			.mediaResults()
			.find((media) => media.id === previewMediaId());
	const openMediaDetail = (
		media: import("@solid-imager/core/domain/media/schemas").Media,
	) => props.onOpenMediaDetail?.(media, page().mediaResults());
	const prepareMediaDetail = (
		media: import("@solid-imager/core/domain/media/schemas").Media,
	) => props.onPrepareMediaDetail?.(media, page().mediaResults());
	const selectPreviewMedia = (
		media: import("@solid-imager/core/domain/media/schemas").Media,
	) => {
		setPreviewMediaId(media.id);
		setIsInspectorVisible(true);
	};
	const updateViewMode = (mode: SourceMediaViewMode) => {
		setViewMode(mode);
		try {
			localStorage.setItem(V2_SOURCE_VIEW_MODE_KEY, mode);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	};

	createEffect(() => {
		const nextId = props.renderMediaPreview
			? reconcileCollectionPreviewId(page().mediaResults(), previewMediaId())
			: null;
		if (nextId !== previewMediaId()) setPreviewMediaId(nextId);
	});

	onMount(() => {
		setIsMounted(true);
		try {
			const storedMode = localStorage.getItem(V2_SOURCE_VIEW_MODE_KEY);
			if (storedMode === "grid" || storedMode === "list") {
				setViewMode(storedMode);
			}
		} catch {
			// Keep the SSR-safe default when storage cannot be read.
		}
	});

	return (
		<section
			aria-label="Media upload area"
			class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]"
			onDragOver={page().handleDragOver}
			onDrop={page().handleDrop}
		>
			<V2SearchToolbar
				actions={
					<div class="flex flex-wrap gap-2">
						<Show when={props.onEnterBulkSelectMode}>
							<Button
								class="min-h-11 sm:min-h-9"
								onClick={() => props.onEnterBulkSelectMode?.()}
								size="sm"
								variant="outline"
							>
								複数選択
							</Button>
						</Show>
						<Button
							class="min-h-11 sm:min-h-9"
							disabled={page().isSyncingMedia() || !page().hasData()}
							onClick={page().handleSyncLoadedMedia}
							size="sm"
							variant="outline"
						>
							{page().isSyncingMedia() ? "同期中..." : "表示分を同期"}
						</Button>
						<Button
							class="min-h-11 sm:min-h-9"
							onClick={page().handleAddButtonClick}
							size="sm"
						>
							<Upload aria-hidden="true" size={15} />
							追加
						</Button>
					</div>
				}
				context="source"
				filterData={page().filterData()}
				itemCount={page().totalCount()}
				onSearch={page().handleSearch}
				presetClient={page().presetClient}
				sourceName={props.mediaSourceName?.() ?? "メディア一覧"}
				onViewModeChange={updateViewMode}
				viewMode={viewMode()}
			/>

			<Show when={props.renderJobProgress && page().jobProgress()}>
				{props.renderJobProgress?.({ jobProgress: page().jobProgress })}
			</Show>
			<Show when={hasFilterError() || hasContentStatus()}>
				<div class="shrink-0 px-3 pt-3 sm:px-4">
					<Show when={hasFilterError()}>
						<FilterErrorBanner
							class="mb-2"
							message="一部の検索フィルターを取得できませんでした。メディア一覧は引き続き利用できます。"
							onRetry={props.onRetryFilters}
						/>
					</Show>
					<QueryStatus
						fetchState={page().contentState().fetchState}
						hasData={page().contentState().data !== undefined}
						hideWhenIdle
						offlineLabel="オフラインのため保存済みデータを表示しています"
						updatingLabel="メディア一覧を更新中..."
					/>
				</div>
			</Show>

			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 [scrollbar-gutter:stable]"
				data-media-scroll={page().mediaSourceId() ?? "v2-source"}
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
								<LoadingRegion label="メディア一覧を読み込んでいます...">
									<MediaGridSkeleton aspectRatio="4/3" />
								</LoadingRegion>
							}
							when={shouldRenderGrid()}
						>
							<SourceMediaGrid
								contextMenuMediaId={page().contextMenuMediaId}
								detailBasePath="/v2/sources"
								enableVirtualization={props.enableVirtualization}
								hasNextPage={page().mediaQuery.hasNextPage}
								isBulkSelectMode={props.isBulkSelectMode}
								isFetchingNextPage={page().mediaQuery.isFetchingNextPage}
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
								onCopyMove={page().handleCopyMove}
								onDelete={page().handleDelete}
								onFindSimilar={props.onFindSimilar}
								onLoadMore={() => page().fetchNextPage()}
								onPreviewSelect={
									props.renderMediaPreview ? selectPreviewMedia : undefined
								}
								onRetry={async () => {
									await page().mediaQuery.refetch();
								}}
								onSelectMedia={props.onSelectMedia}
								onSyncSingleMedia={page().handleSyncSingleMedia}
								onToggleSelect={props.onToggleSelect}
								renderItem={props.renderItem}
								previewSelectedMediaId={
									props.renderMediaPreview ? previewMediaId : undefined
								}
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
									sourceName={props.mediaSourceName?.()}
								/>
							</Show>
						)}
					</Show>
				</div>
			</div>

			<input
				accept=".json,.ndjson,.tar"
				class="hidden"
				id="v2-restore-input"
				onChange={page().handleRestoreSelect}
				ref={page().setRestoreInputRef}
				type="file"
			/>
			<input
				accept="image/*,.json"
				class="hidden"
				onChange={page().handleFileSelect}
				ref={page().setFileInputRef}
				type="file"
			/>

			{(() => {
				const UploadModal = props.uploadModalComponent;
				return (
					<UploadModal
						initialFile={page().fileToUpload()}
						isOpen={page().showUploadModal()}
						onClose={() => {
							page().setShowUploadModal(false);
							page().setPastedUrl(null);
							page().setFileToUpload(null);
						}}
						onUpload={page().handleUpload}
						onUrlFetch={(file) => page().setFileToUpload(file)}
						pastedUrl={page().pastedUrl()}
					/>
				);
			})()}

			<Dialog
				onOpenChange={page().setDeleteDialogOpen}
				open={page().deleteDialogOpen()}
			>
				<DialogContent class="v2-theme">
					<DialogHeader>
						<DialogTitle>メディアを削除</DialogTitle>
						<DialogDescription>
							この操作は取り消せません。選択したメディアを削除しますか？
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => page().setDeleteDialogOpen(false)}
							variant="outline"
						>
							キャンセル
						</Button>
						<Button onClick={page().confirmDelete} variant="destructive">
							削除
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{(() => {
				const MoveCopyDialog = props.moveCopyDialogComponent;
				return (
					<MoveCopyDialog
						currentSourceId={page().mediaSourceId() || ""}
						mode={page().moveCopyMode()}
						onConfirm={page().handleConfirmCopyMove}
						onOpenChange={page().setMoveCopyDialogOpen}
						open={page().moveCopyDialogOpen()}
					/>
				);
			})()}
		</section>
	);
}
