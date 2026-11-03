import type { Media } from "@solid-imager/core/media";
import { getErrorMessage } from "@solid-imager/core/utils";
import { type Accessor, createMemo, createSignal } from "solid-js";
import {
	type MediaCollectionSelectionMode,
	useMediaCollectionSelection,
} from "./use-media-collection-selection";

/** Platform operations used by the collection controller. */
export type MediaCollectionOperations = {
	deleteMedia: (sourceId: string, mediaId: string) => Promise<unknown>;
	copyMedia: (mediaId: string, targetSourceId: string) => Promise<unknown>;
	moveMedia: (mediaId: string, targetSourceId: string) => Promise<unknown>;
};

export type MediaCollectionNotifications = {
	success: (message: string) => void;
	error: (message: string) => void;
};

type MediaCollectionActionsOptions = {
	media: Accessor<readonly Media[]>;
	refresh: () => void;
	operations: MediaCollectionOperations;
	notify: MediaCollectionNotifications;
};

/** Selection and mutation workflows shared by Web and Tauri collections. */
export function useMediaCollectionActions(
	options: MediaCollectionActionsOptions,
) {
	const visibleIds = createMemo(() => options.media().map((media) => media.id));
	const selection = useMediaCollectionSelection(visibleIds);
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const [isBulkActionOpen, setIsBulkActionOpen] = createSignal(false);
	const [deleteTarget, setDeleteTarget] = createSignal<Media | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [isDeleteSubmitting, setIsDeleteSubmitting] = createSignal(false);
	const [moveCopyTarget, setMoveCopyTarget] = createSignal<Media | null>(null);
	const [moveCopyMode, setMoveCopyMode] = createSignal<"copy" | "move">("copy");
	const [isMoveCopySubmitting, setIsMoveCopySubmitting] = createSignal(false);
	const selectedMediaItems = createMemo(() =>
		options
			.media()
			.filter((media) => selection.isSelected(media.id))
			.map((media) => ({
				mediaId: media.id,
				mediaSourceId: media.mediaSourceId,
			})),
	);

	const selectMedia = (id: string, mode: MediaCollectionSelectionMode) => {
		setIsBulkSelectMode(true);
		selection.select(id, mode);
	};
	const selectAll = () => {
		setIsBulkSelectMode(true);
		selection.selectAll();
	};
	const clearSelection = () => {
		setIsBulkSelectMode(false);
		selection.clear();
	};
	const forgetSelectedMedia = (id: string) => {
		if (selection.isSelected(id)) selection.select(id, "toggle");
		if (selection.selectedIds().size === 0) setIsBulkSelectMode(false);
	};
	const openDelete = (id: string) => {
		if (isDeleteSubmitting()) return;
		const media = options.media().find((item) => item.id === id);
		if (!media) return;
		setDeleteTarget(media);
		setIsDeleteDialogOpen(true);
	};
	const changeDeleteOpen = (open: boolean) => {
		setIsDeleteDialogOpen(open);
		if (!open && !isDeleteSubmitting()) setDeleteTarget(null);
	};
	const confirmDelete = async () => {
		const media = deleteTarget();
		if (!media || isDeleteSubmitting()) return;
		setIsDeleteSubmitting(true);
		try {
			await options.operations.deleteMedia(media.mediaSourceId, media.id);
			forgetSelectedMedia(media.id);
			options.notify.success("Media deleted");
			options.refresh();
		} catch (error) {
			options.notify.error(`Failed to delete media: ${getErrorMessage(error)}`);
		} finally {
			setIsDeleteSubmitting(false);
			setIsDeleteDialogOpen(false);
			setDeleteTarget(null);
		}
	};
	const openCopyMove = (id: string, mode: "copy" | "move") => {
		if (isMoveCopySubmitting()) return;
		const media = options.media().find((item) => item.id === id);
		if (!media) return;
		setMoveCopyTarget(media);
		setMoveCopyMode(mode);
	};
	const changeCopyMoveOpen = (open: boolean) => {
		if (!open) setMoveCopyTarget(null);
	};
	const confirmCopyMove = async (targetSourceId: string) => {
		const media = moveCopyTarget();
		if (!media || isMoveCopySubmitting()) return;
		const mode = moveCopyMode();
		setIsMoveCopySubmitting(true);
		try {
			const action =
				mode === "copy"
					? options.operations.copyMedia
					: options.operations.moveMedia;
			await action(media.id, targetSourceId);
			options.notify.success(`Media ${mode === "copy" ? "copied" : "moved"}`);
			options.refresh();
		} catch (error) {
			options.notify.error(
				`Failed to ${mode} media: ${getErrorMessage(error)}`,
			);
		} finally {
			setIsMoveCopySubmitting(false);
			setMoveCopyTarget(null);
		}
	};
	const onBulkSuccess = (partial: boolean) => {
		if (!partial) clearSelection();
		options.refresh();
	};

	return {
		selection,
		isBulkSelectMode,
		selectedMediaItems,
		selectMedia,
		selectAll,
		clearSelection,
		isBulkActionOpen,
		changeBulkActionOpen: (open: boolean) => setIsBulkActionOpen(open),
		onBulkSuccess,
		deleteTarget,
		isDeleteDialogOpen,
		isDeleteSubmitting,
		openDelete,
		changeDeleteOpen,
		confirmDelete,
		moveCopyTarget,
		moveCopyMode,
		isMoveCopyDialogOpen: () => moveCopyTarget() !== null,
		openCopyMove,
		changeCopyMoveOpen,
		confirmCopyMove,
	};
}

export type MediaCollectionActions = ReturnType<
	typeof useMediaCollectionActions
>;
