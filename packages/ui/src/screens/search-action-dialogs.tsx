import { t } from "@solid-imager/i18n";
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
						<DialogTitle>{t("sourceMediaScreen.deleteMedia")}</DialogTitle>
						<DialogDescription>
							{t("searchActionDialogs.thisActionCannotBeUndoneDeleteValue", {
								value0: String(
									actions.deleteTarget()?.fileName ?? t("labels.selectedMedia"),
								),
							})}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							disabled={actions.isDeleteSubmitting()}
							onClick={() => actions.changeDeleteOpen(false)}
							variant="outline"
						>
							{t("actions.cancel")}
						</Button>
						<Button
							disabled={actions.isDeleteSubmitting()}
							onClick={() => {
								void actions.confirmDelete();
							}}
							variant="destructive"
						>
							{actions.isDeleteSubmitting()
								? t("status.deleting")
								: t("actions.delete")}
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
				error={sources.error ? t("feedback.sourcesLoadFailed") : null}
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
