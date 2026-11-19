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
	onConfirm: () => Promise<void>;
}) {
	return (
		<AlertDialog
			open={props.open}
			onOpenChange={(open) => {
				if (!props.isSubmitting) props.onOpenChange(open);
			}}
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
					<AlertDialogCancel disabled={props.isSubmitting}>
						{t("actions.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						aria-busy={props.isSubmitting}
						disabled={props.isSubmitting}
						onClick={(event) => {
							event.preventDefault();
							void props.onConfirm();
						}}
					>
						{props.isSubmitting ? t("status.deleting") : t("actions.delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
