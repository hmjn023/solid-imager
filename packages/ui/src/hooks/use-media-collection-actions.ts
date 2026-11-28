import type { Media } from "@solid-imager/core/media";
import { getErrorMessage } from "@solid-imager/core/utils";
import { t } from "@solid-imager/i18n";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
} from "solid-js";
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
};

type MediaCollectionActionsOptions = {
	media: Accessor<readonly Media[]>;
	refresh: () => void;
	operations: MediaCollectionOperations;
	notify: MediaCollectionNotifications;
};

type MediaActionTarget = Pick<Media, "id" | "mediaSourceId"> &
	Partial<Pick<Media, "fileName">>;

function isCopyRejected(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error.code === "BAD_REQUEST" ||
			error.code === "UNAUTHORIZED" ||
			error.code === "FORBIDDEN" ||
			error.code === "NOT_FOUND")
	);
}

export function useMediaItemActions(options: {
	findMedia: (id: string) => MediaActionTarget | undefined;
	operations: MediaCollectionOperations;
	notify: MediaCollectionNotifications;
	onDeleted: (media: MediaActionTarget) => void;
	onTransferred: (media: MediaActionTarget, targetSourceId: string) => void;
}) {
	const [deleteTarget, setDeleteTarget] = createSignal<MediaActionTarget>();
	const [isDeleteSubmitting, setIsDeleteSubmitting] = createSignal(false);
	const [deleteError, setDeleteError] = createSignal<string>();
	const [moveCopyTarget, setMoveCopyTarget] = createSignal<MediaActionTarget>();
	const [moveCopyMode, setMoveCopyMode] = createSignal<"copy" | "move">("copy");
	const [isMoveCopySubmitting, setIsMoveCopySubmitting] = createSignal(false);
	const [moveCopyError, setMoveCopyError] = createSignal<string>();
	const unconfirmedCopies = new Map<string, Set<string>>();
	let deletePending = false;
	let moveCopyPending = false;

	const openDelete = (id: string) => {
		if (deletePending) return;
		const target = options.findMedia(id);
		if (!target) return;
		setDeleteError(undefined);
		setDeleteTarget(target);
	};
	const changeDeleteOpen = (open: boolean) => {
		if (open || deletePending) return;
		setDeleteTarget(undefined);
		setDeleteError(undefined);
	};
	const confirmDelete = async () => {
		const media = deleteTarget();
		if (!media || deletePending) return false;
		deletePending = true;
		setIsDeleteSubmitting(true);
		setDeleteError(undefined);
		try {
			await options.operations.deleteMedia(media.mediaSourceId, media.id);
		} catch (error) {
			setDeleteError(
				t("mediaActions.failedToDeleteMediaValue", {
					value0: getErrorMessage(error),
				}),
			);
			return false;
		} finally {
			deletePending = false;
			setIsDeleteSubmitting(false);
		}
		setDeleteTarget(undefined);
		options.notify.success(t("useSourceMediaPage.mediaDeletedSuccessfully"));
		options.onDeleted(media);
		return true;
	};
	const openCopyMove = (id: string, mode: "copy" | "move") => {
		if (moveCopyPending) return;
		const target = options.findMedia(id);
		if (!target) return;
		setMoveCopyMode(mode);
		setMoveCopyError(undefined);
		setMoveCopyTarget(target);
	};
	const changeCopyMoveOpen = (open: boolean) => {
		if (open || moveCopyPending) return;
		setMoveCopyTarget(undefined);
		setMoveCopyError(undefined);
	};
	const confirmCopyMove = async (targetSourceId: string) => {
		const media = moveCopyTarget();
		if (
			!media ||
			moveCopyPending ||
			!targetSourceId ||
			targetSourceId === media.mediaSourceId
		)
			return;
		const mode = moveCopyMode();
		if (
			mode === "copy" &&
			unconfirmedCopies.get(media.id)?.has(targetSourceId)
		) {
			setMoveCopyError(t("useSourceMediaPage.copyOutcomeUnknown"));
			return;
		}
		moveCopyPending = true;
		setIsMoveCopySubmitting(true);
		setMoveCopyError(undefined);
		try {
			const action =
				mode === "copy"
					? options.operations.copyMedia
					: options.operations.moveMedia;
			await action(media.id, targetSourceId);
		} catch (error) {
			if (mode === "copy" && !isCopyRejected(error)) {
				const destinations =
					unconfirmedCopies.get(media.id) ?? new Set<string>();
				destinations.add(targetSourceId);
				unconfirmedCopies.set(media.id, destinations);
				setMoveCopyError(t("useSourceMediaPage.copyOutcomeUnknown"));
				return;
			}
			setMoveCopyError(
				t(
					mode === "copy"
						? "useSourceMediaPage.copyFailed"
						: "useSourceMediaPage.moveFailed",
					{
						error: getErrorMessage(error),
					},
				),
			);
			return;
		} finally {
			moveCopyPending = false;
			setIsMoveCopySubmitting(false);
		}
		setMoveCopyTarget(undefined);
		options.notify.success(
			t("useSourceMediaPage.mediaValueSuccessfully", {
				value0: t(
					mode === "copy"
						? "useSourceMediaPage.copied"
						: "useSourceMediaPage.moved",
				),
			}),
		);
		options.onTransferred(media, targetSourceId);
	};

	return {
		deleteTarget,
		isDeleteDialogOpen: () => deleteTarget() !== undefined,
		isDeleteSubmitting,
		deleteError,
		openDelete,
		changeDeleteOpen,
		confirmDelete,
		moveCopyTarget,
		moveCopyMode,
		isMoveCopySubmitting,
		moveCopyError,
		isMoveCopyDialogOpen: () => moveCopyTarget() !== undefined,
		openCopyMove,
		changeCopyMoveOpen,
		confirmCopyMove,
	};
}

/** Selection and mutation workflows shared by Web and Tauri collections. */
export function useMediaCollectionActions(
	options: MediaCollectionActionsOptions,
) {
	const visibleIds = createMemo(() => options.media().map((media) => media.id));
	const selection = useMediaCollectionSelection(visibleIds);
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const [isBulkActionOpen, setIsBulkActionOpen] = createSignal(false);
	createEffect(
		() => visibleIds().length === 0 && isBulkSelectMode(),
		(empty) => {
			if (empty) setIsBulkSelectMode(false);
		},
	);
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
	const forgetSelectedMedia = (ids: string[]) => {
		const selectedIds = selection.selectedIds();
		let remaining = selectedIds.size;
		for (const id of new Set(ids)) {
			if (!selectedIds.has(id)) continue;
			selection.select(id, "toggle");
			remaining--;
		}
		if (remaining === 0) setIsBulkSelectMode(false);
	};
	const itemActions = useMediaItemActions({
		findMedia: (id) => options.media().find((item) => item.id === id),
		operations: options.operations,
		notify: options.notify,
		onDeleted: (media) => {
			forgetSelectedMedia([media.id]);
			options.refresh();
		},
		onTransferred: options.refresh,
	});
	const onBulkSuccess = (partial: boolean, succeededMediaIds: string[]) => {
		if (succeededMediaIds.length > 0 || !partial) {
			forgetSelectedMedia(succeededMediaIds);
		}
		options.refresh();
	};

	return {
		selection,
		isBulkSelectMode,
		enterBulkSelection: () => setIsBulkSelectMode(true),
		selectedMediaItems,
		selectMedia,
		selectAll,
		clearSelection,
		isBulkActionOpen,
		changeBulkActionOpen: (open: boolean) => setIsBulkActionOpen(open),
		onBulkSuccess,
		...itemActions,
	};
}

export type MediaCollectionActions = ReturnType<
	typeof useMediaCollectionActions
>;
