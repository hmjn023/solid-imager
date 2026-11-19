import {
	BulkActionDialog,
	type BulkActionDialogProps,
} from "../bulk-action-dialog";
import type { MediaCollectionActions } from "../hooks/use-media-collection-actions";
import { MediaDeleteDialog } from "../media-delete-dialog";
import { MoveCopyMediaDialog } from "../move-copy-media-dialog";

export type SearchBulkOperations = Pick<
	BulkActionDialogProps,
	| "listSources"
	| "bulkCopyToSource"
	| "bulkDeleteMedia"
	| "bulkMoveMedia"
	| "bulkMoveToSource"
>;

export function SearchActionDialogs(props: {
	actions: MediaCollectionActions;
	operations: SearchBulkOperations;
}) {
	const actions = props.actions;
	return (
		<>
			<MediaDeleteDialog
				open={actions.isDeleteDialogOpen()}
				fileName={actions.deleteTarget()?.fileName}
				isSubmitting={actions.isDeleteSubmitting()}
				error={actions.deleteError()}
				onOpenChange={actions.changeDeleteOpen}
				onConfirm={actions.confirmDelete}
			/>
			<MoveCopyMediaDialog
				currentSourceId={actions.moveCopyTarget()?.mediaSourceId ?? ""}
				mode={actions.moveCopyMode()}
				open={actions.isMoveCopyDialogOpen()}
				onOpenChange={actions.changeCopyMoveOpen}
				onConfirm={actions.confirmCopyMove}
				listSources={props.operations.listSources}
				isSubmitting={actions.isMoveCopySubmitting()}
				error={actions.moveCopyError()}
			/>
			<BulkActionDialog
				{...props.operations}
				mediaIds={actions.selectedMediaItems().map((item) => item.mediaId)}
				mediaItems={actions.selectedMediaItems()}
				open={actions.isBulkActionOpen()}
				onOpenChange={actions.changeBulkActionOpen}
				onSuccess={actions.onBulkSuccess}
			/>
		</>
	);
}
