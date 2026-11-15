import { t } from "@solid-imager/i18n";
import { createResource } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../alert-dialog";
import {
	BulkActionDialog,
	type BulkActionDialogProps,
} from "../bulk-action-dialog";
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
			<AlertDialog
				open={actions.isDeleteDialogOpen()}
				onOpenChange={(open) => {
					if (open || !actions.isDeleteSubmitting()) {
						actions.changeDeleteOpen(open);
					}
				}}
			>
				<AlertDialogContent data-workspace-theme="">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("sourceMediaScreen.deleteMedia")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("searchActionDialogs.thisActionCannotBeUndoneDeleteValue", {
								value0: String(
									actions.deleteTarget()?.fileName ?? t("labels.selectedMedia"),
								),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={actions.isDeleteSubmitting()}>
							{t("actions.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={actions.isDeleteSubmitting()}
							onClick={() => {
								void actions.confirmDelete();
							}}
						>
							{actions.isDeleteSubmitting()
								? t("status.deleting")
								: t("actions.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
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
