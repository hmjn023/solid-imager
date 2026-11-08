import { createResource } from "solid-js";
import {
	BulkActionDialog,
	type BulkActionDialogProps,
} from "../bulk-action-dialog";
import { Button } from "../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import type { MediaCollectionActions } from "../hooks/use-media-collection-actions";
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
	const [sources] = createResource(
		() => (actions.isMoveCopyDialogOpen() ? true : null),
		() => props.operations.listSources(),
		{ initialValue: [] },
	);

	return (
		<>
			<Dialog
				open={actions.isDeleteDialogOpen()}
				onOpenChange={actions.changeDeleteOpen}
			>
				<DialogContent data-workspace-theme="">
					<DialogHeader>
						<DialogTitle>メディアを削除</DialogTitle>
						<DialogDescription>
							この操作は取り消せません。
							{actions.deleteTarget()?.fileName ?? "選択したメディア"}
							を削除しますか？
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							disabled={actions.isDeleteSubmitting()}
							onClick={() => actions.changeDeleteOpen(false)}
							variant="outline"
						>
							キャンセル
						</Button>
						<Button
							disabled={actions.isDeleteSubmitting()}
							onClick={() => {
								void actions.confirmDelete();
							}}
							variant="destructive"
						>
							{actions.isDeleteSubmitting() ? "削除中..." : "削除"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<MoveCopyMediaDialog
				currentSourceId={actions.moveCopyTarget()?.mediaSourceId ?? ""}
				mode={actions.moveCopyMode()}
				open={actions.isMoveCopyDialogOpen()}
				onOpenChange={actions.changeCopyMoveOpen}
				onConfirm={(id) => {
					void actions.confirmCopyMove(id);
				}}
				sources={sources().flatMap((source) =>
					source.id ? [{ id: source.id, name: source.name }] : [],
				)}
				isLoading={sources.loading}
				error={sources.error ? "Failed to load sources." : null}
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
