import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Button } from "../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import { useCurrentSearchPersistence } from "../hooks/use-current-search-persistence";
import type { UseSourceMediaPageResult } from "../hooks/use-source-media-page";
import { SearchControlPanel } from "../search-control-panel";

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
	renderGrid: (props: {
		mediaPages: () =>
			| import("@solid-imager/core/domain/media/schemas").MediaSearchResponse[]
			| undefined;
		mediaResults: () => import("@solid-imager/core/domain/media/schemas").MediaSearchResponse["media"];
		mediaSourceId: () => string | undefined;
		isPending: boolean;
		isError: boolean;
		isFetchingNextPage: boolean;
		queryError: Error | null;
		contextMenuMediaId: () => string | null;
		setContextMenuMediaId: (
			value: string | null | ((prev: string | null) => string | null),
		) => void;
		onDelete: (mediaId: string) => void;
		onCopyMove: (mediaId: string, mode: "copy" | "move") => void;
		onSyncSingleMedia: (mediaId: string) => void;
		loadMoreRef: HTMLDivElement | undefined;
		setLoadMoreRef: (el: HTMLDivElement) => void;
	}) => JSX.Element;
	renderJobProgress?: (props: {
		jobProgress: () =>
			| import("@solid-imager/core/domain/sources/events").JobProgressEvent
			| null;
	}) => JSX.Element;
	renderUploadModal: () => JSX.Element;
	renderMoveCopyDialog: () => JSX.Element;
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

			<div class="grid gap-6 md:grid-cols-[300px_1fr]">
				<div class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border bg-card p-4 md:block">
					<h3 class="mb-4 font-semibold text-lg">検索フィルター</h3>
					<div class="space-y-4">
						<SearchControlPanel
							class="w-full"
							context="source"
							filterData={page().filterData}
							onSearch={page().handleSearch}
							presetClient={page().presetClient}
							usePopover={false}
						/>
					</div>
				</div>

				{props.renderGrid({
					mediaPages: () => page().mediaQuery.data?.pages,
					mediaResults: page().mediaResults,
					mediaSourceId: page().mediaSourceId,
					isPending: page().mediaQuery.isPending,
					isError: page().mediaQuery.isError,
					isFetchingNextPage: page().mediaQuery.isFetchingNextPage,
					queryError: page().mediaQuery.error ?? null,
					contextMenuMediaId: page().contextMenuMediaId,
					setContextMenuMediaId: page().setContextMenuMediaId,
					onDelete: page().handleDelete,
					onCopyMove: page().handleCopyMove,
					onSyncSingleMedia: page().handleSyncSingleMedia,
					loadMoreRef: page().loadMoreRef,
					setLoadMoreRef: page().setLoadMoreRef,
				})}
			</div>

			{/* Hidden file inputs */}
			<input
				accept=".json,.zip"
				class="hidden"
				id="restore-input"
				onChange={page().handleRestoreSelect}
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

			{props.renderUploadModal()}

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

			{props.renderMoveCopyDialog()}
		</section>
	);
}
