import { t } from "@solid-imager/i18n";
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

export type SourceDeleteModalProps = {
	isOpen: boolean;
	isDeleting?: boolean;
	onClose: () => void;
	onConfirm: (id: string) => void;
	sourceToDelete?: { id?: string | null; name?: string | null } | null;
};

export function SourceDeleteModal(props: SourceDeleteModalProps) {
	return (
		<AlertDialog
			onOpenChange={(open) => {
				if (!open && !props.isDeleting) props.onClose();
			}}
			open={props.isOpen}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("sourceDeleteModal.deleteMediaSource")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("sourceDeleteModal.areYouSureYouWantToDelete")}{" "}
						<span class="font-bold">{props.sourceToDelete?.name}</span>
						{t("sourceDeleteModal.thisActionCannotBeUndoneFilesOnDiskWill")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={props.isDeleting}>
						{t("actions.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={props.isDeleting}
						onClick={(event) => {
							event.preventDefault();
							if (!props.isDeleting && props.sourceToDelete?.id) {
								props.onConfirm(props.sourceToDelete.id);
							}
						}}
					>
						{t("actions.delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
