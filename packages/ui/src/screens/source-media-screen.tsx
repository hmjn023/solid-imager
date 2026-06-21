import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
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
import { useCurrentSearchPersistence } from "../hooks/use-current-search-persistence";
import type {
	UploadOptions,
	UseSourceMediaPageResult,
} from "../hooks/use-source-media-page";
import { SearchControlPanel } from "../search-control-panel";
import { SourceMediaGrid } from "../source-media-grid";

export type SourceMediaScreenProps = {
	page: UseSourceMediaPageResult;
	renderActions: (props: {
		isSyncing: boolean;
		isSyncDisabled: boolean;
		onDumpDownload: (mode?: "json" | "zip") => void;
		onSyncLoadedMedia: () => void;
		onAddMedia: () => void;
		onRestore: () => void;
	}) => JSX.Element;
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
};

export function SourceMediaScreen(props: SourceMediaScreenProps) {
	const page = () => props.page;

	// Enable auto-save/restore of search conditions
	useCurrentSearchPersistence(page().mediaSourceId, page().presetClient);

	return (
		<section
			aria-label="Media upload area"
			class="container mx-auto min-h-[calc(100vh-2rem)] p-4"
			onDragOver={page().handleDragOver}
			onDrop={page().handleDrop}
		>
			{props.renderActions({
				isSyncing: page().isSyncingMedia(),
				isSyncDisabled:
					page().isSyncingMedia() || !page().mediaQuery.data?.pages.length,
				onDumpDownload: page().handleDumpDownload,
				onSyncLoadedMedia: page().handleSyncLoadedMedia,
				onAddMedia: page().handleAddButtonClick,
				onRestore: () => page().restoreInputRef?.click(),
			})}

			<Show when={props.renderJobProgress && page().jobProgress()}>
				{props.renderJobProgress?.({
					jobProgress: page().jobProgress,
				})}
			</Show>

			<div class="mb-4 flex items-center justify-between">
				<h1 class="font-bold text-2xl">
					Media in Source: {page().mediaSourceId()}
				</h1>
				<Button
					disabled={
						page().isSyncingMedia() || !page().mediaQuery.data?.pages.length
					}
					onClick={page().handleSyncLoadedMedia}
					variant="outline"
				>
					{page().isSyncingMedia() ? "Syncing..." : "Sync Loaded Media"}
				</Button>
			</div>

			<div class="grid gap-6 md:grid-cols-[300px_1fr]">
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

				<SourceMediaGrid
					contextMenuMediaId={page().contextMenuMediaId}
					enableVirtualization={props.enableVirtualization}
					isError={page().mediaQuery.isError}
					isFetchingNextPage={page().mediaQuery.isFetchingNextPage}
					isPending={page().mediaQuery.isPending}
					mediaResults={page().mediaResults}
					mediaSourceId={page().mediaSourceId}
					onCopyMove={page().handleCopyMove}
					onDelete={page().handleDelete}
					onLoadMore={() => page().mediaQuery.fetchNextPage()}
					onRetry={() => {
						void page().mediaQuery.refetch();
					}}
					onSyncSingleMedia={page().handleSyncSingleMedia}
					onToggleSelect={props.onToggleSelect}
					isBulkSelectMode={props.isBulkSelectMode}
					isSelected={props.isSelected}
					onBulkAction={props.onBulkAction}
					onClearSelection={props.onClearSelection}
					selectedCount={props.selectedCount}
					hasNextPage={page().mediaQuery.hasNextPage}
					queryError={page().mediaQuery.error ?? null}
					renderItem={props.renderItem}
					setContextMenuMediaId={page().setContextMenuMediaId}
					setLoadMoreRef={page().setLoadMoreRef}
					showOpenInNewTab={props.showOpenInNewTab}
					totalCount={page().mediaQuery.data?.pages[0]?.total}
				/>
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
			<button
				aria-label="Add media"
				class="fixed right-8 bottom-8 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
				onClick={page().handleAddButtonClick}
				type="button"
			>
				<span class="text-3xl leading-none">＋</span>
			</button>

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
