import type { Media } from "@solid-imager/core/domain/media/schemas";
import { ClientOnly } from "@tanstack/solid-router";
import type { Component, JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { FilterErrorBanner, QueryStatus } from "../async-state";
import { Button } from "../button";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import type {
	UploadOptions,
	UseSourceMediaPageResult,
} from "../hooks/use-source-media-page";
import { MobileSearchFilterDialog } from "../mobile-search-filter-dialog";
import { SearchControlPanel } from "../search-control-panel";
import { LoadingRegion, MediaGridSkeleton } from "../skeleton";
import { SourceMediaGrid } from "../source-media-grid";

export type SourceMediaScreenProps = {
	page: UseSourceMediaPageResult;
	/** Render navigation actions without giving them ownership of filter draft state. */
	renderActions: (props: { onOpenMobileFilters: () => void }) => JSX.Element;
	/** Render a single media grid item. */
	renderItem: (
		media: Media,
		options: {
			onContextMenu: () => void;
			isBulkSelectMode?: boolean;
			isSelected?: boolean;
		},
	) => JSX.Element;
	renderJobProgress?: (props: {
		jobProgress: () =>
			| import("@solid-imager/core/domain/sources/events").JobProgressEvent
			| null;
	}) => JSX.Element;
	uploadModalComponent: Component<{
		isOpen: boolean;
		onClose: () => void;
		onUpload: (options: UploadOptions) => Promise<void>;
		initialFile: File | null;
		onUrlFetch: (file: File) => void;
		pastedUrl: string | null;
	}>;
	moveCopyDialogComponent: Component<{
		open: boolean;
		onOpenChange: (open: boolean) => void;
		mode: "copy" | "move";
		onConfirm: (targetSourceId: string) => void;
		currentSourceId: string;
	}>;
	/** Enable virtualization for large lists. Default: false. */
	enableVirtualization?: boolean;
	/** Show "Open in New Tab" context menu item. Default: false. */
	showOpenInNewTab?: boolean;
	onToggleSelect?: (mediaId: string) => void;
	isBulkSelectMode?: () => boolean;
	isSelected?: (mediaId: string) => boolean;
	onBulkAction?: () => void;
	onClearSelection?: () => void;
	selectedCount?: () => number;
	onEnterBulkSelectMode?: () => void;
	onRetryFilters: () => void | Promise<void>;
};

export function SourceMediaScreen(props: SourceMediaScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [isMobileFilterOpen, setIsMobileFilterOpen] = createSignal(false);
	const page = () => props.page;
	const filterStates = () => Object.values(page().filterStates());
	const shouldRenderGrid = () => !props.enableVirtualization || isMounted();

	onMount(() => {
		setIsMounted(true);
	});

	return (
		<section
			aria-label="Media upload area"
			class="container mx-auto min-h-[calc(100dvh-2rem)] p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(7rem+env(safe-area-inset-bottom))]"
			onDragOver={page().handleDragOver}
			onDrop={page().handleDrop}
		>
			{props.renderActions({
				onOpenMobileFilters: () => setIsMobileFilterOpen(true),
			})}
			<ClientOnly>
				<MobileSearchFilterDialog
					context="source"
					filterData={page().filterData()}
					onOpenChange={setIsMobileFilterOpen}
					onSearch={page().handleSearch}
					open={isMobileFilterOpen()}
					presetClient={page().presetClient}
					usePopover={false}
				/>
			</ClientOnly>

			<Show when={props.renderJobProgress && page().jobProgress()}>
				{props.renderJobProgress?.({
					jobProgress: page().jobProgress,
				})}
			</Show>

			<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h1 class="min-w-0 break-all font-bold text-xl sm:text-2xl">
					Media in Source: {page().mediaSourceId()}
				</h1>
				<div class="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
					<Show when={props.onEnterBulkSelectMode}>
						<Button
							class="w-full sm:w-auto"
							onClick={() => props.onEnterBulkSelectMode?.()}
							variant="outline"
						>
							複数選択
						</Button>
					</Show>
					<Button
						class="w-full sm:w-auto"
						disabled={
							page().isSyncingMedia() || !page().mediaQuery.data?.pages.length
						}
						onClick={page().handleSyncLoadedMedia}
						variant="outline"
					>
						{page().isSyncingMedia() ? "Syncing..." : "Sync Loaded Media"}
					</Button>
				</div>
			</div>
			<Show
				when={filterStates().some(
					(state) => state.phase === "error" || state.phase === "offline",
				)}
			>
				<FilterErrorBanner
					class="mb-3"
					message="一部の検索フィルターを取得できませんでした。メディア一覧は引き続き利用できます。"
					onRetry={props.onRetryFilters}
				/>
			</Show>

			<div class="grid min-w-0 gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
				<Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
					<CardHeader>
						<CardTitle>検索フィルター</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<SearchControlPanel
							class="w-full"
							context="source"
							filterData={page().filterData()}
							onSearch={page().handleSearch}
							presetClient={page().presetClient}
							usePopover={false}
						/>
					</CardContent>
				</Card>

				<div class="min-w-0">
					<QueryStatus
						class="mb-2"
						fetchState={page().contentState().fetchState}
						hasData={page().contentState().data !== undefined}
						offlineLabel="オフラインのため保存済みデータを表示しています"
						updatingLabel="メディア一覧を更新中..."
					/>
					<Show
						fallback={
							<LoadingRegion label="メディア一覧を読み込んでいます...">
								<MediaGridSkeleton />
							</LoadingRegion>
						}
						when={shouldRenderGrid()}
					>
						<SourceMediaGrid
							contextMenuMediaId={page().contextMenuMediaId}
							enableVirtualization={props.enableVirtualization}
							isFetchingNextPage={page().mediaQuery.isFetchingNextPage}
							mediaResults={page().mediaResults}
							mediaSourceId={page().mediaSourceId}
							onCopyMove={page().handleCopyMove}
							onDelete={page().handleDelete}
							onLoadMore={() => page().mediaQuery.fetchNextPage()}
							onRetry={async () => {
								await page().mediaQuery.refetch();
							}}
							onSyncSingleMedia={page().handleSyncSingleMedia}
							onToggleSelect={props.onToggleSelect}
							isBulkSelectMode={props.isBulkSelectMode}
							isSelected={props.isSelected}
							onBulkAction={props.onBulkAction}
							onClearSelection={props.onClearSelection}
							selectedCount={props.selectedCount}
							hasNextPage={page().mediaQuery.hasNextPage}
							renderItem={props.renderItem}
							setContextMenuMediaId={page().setContextMenuMediaId}
							setLoadMoreRef={page().setLoadMoreRef}
							showOpenInNewTab={props.showOpenInNewTab}
							state={page().contentState}
							totalCount={page().mediaQuery.data?.pages[0]?.total}
						/>
					</Show>
				</div>
			</div>

			{/* Hidden file inputs */}
			<input
				accept=".json,.ndjson,.tar"
				class="hidden"
				id="restore-input"
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

			{/* Floating add button */}
			<Show when={!props.isBulkSelectMode?.()}>
				<button
					aria-label="Add media"
					class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:right-8 sm:bottom-[calc(2rem+env(safe-area-inset-bottom))]"
					onClick={page().handleAddButtonClick}
					type="button"
				>
					<span class="text-3xl leading-none">＋</span>
				</button>
			</Show>

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
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Media</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this media? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => page().setDeleteDialogOpen(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button onClick={page().confirmDelete} variant="destructive">
							Delete
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
