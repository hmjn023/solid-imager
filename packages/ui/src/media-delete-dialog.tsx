import { t } from "@solid-imager/i18n";
import { Show } from "solid-js";
import { Alert, AlertDescription } from "./alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";

export function MediaDeleteDialog(props: {
	open: boolean;
	fileName?: string;
	isSubmitting: boolean;
	error?: string;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<boolean>;
}) {
	let confirmSucceeded = false;
	return (
		<AlertDialog
			open={props.open}
			onOpenChange={(open, details) => {
				if (
					props.isSubmitting ||
					(details.reason === "action" && !confirmSucceeded)
				) {
					details.cancel();
					return;
				}
				props.onOpenChange(open);
			}}
			pendingAnnouncement={t("status.deleting")}
		>
			<AlertDialogContent data-workspace-theme="">
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("sourceMediaScreen.deleteMedia")}
					</AlertDialogTitle>
					<AlertDialogDescription class="break-words">
						{t("searchActionDialogs.thisActionCannotBeUndoneDeleteValue", {
							value0: props.fileName ?? t("labels.selectedMedia"),
						})}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Show when={props.error}>
					<Alert variant="destructive">
						<AlertDescription>{props.error}</AlertDescription>
					</Alert>
				</Show>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						action={async () => {
							confirmSucceeded = await props.onConfirm();
						}}
					>
						{props.isSubmitting ? t("status.deleting") : t("actions.delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
