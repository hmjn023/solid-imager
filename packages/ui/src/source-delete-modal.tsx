import { t } from "@solid-imager/i18n";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";

export type SourceDeleteModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (id: string) => void;
	sourceToDelete?: { id?: string | null; name?: string | null } | null;
};

export function SourceDeleteModal(props: SourceDeleteModalProps) {
	return (
		<Dialog onOpenChange={() => props.onClose()} open={props.isOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("sourceDeleteModal.deleteMediaSource")}</DialogTitle>
					<DialogDescription>
						{t("sourceDeleteModal.areYouSureYouWantToDelete")}{" "}
						<span class="font-bold">{props.sourceToDelete?.name}</span>
						{t("sourceDeleteModal.thisActionCannotBeUndoneFilesOnDiskWill")}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button onClick={() => props.onClose()} variant="outline">
						{t("actions.cancel")}
					</Button>
					<Button
						onClick={() =>
							props.sourceToDelete?.id &&
							props.onConfirm(props.sourceToDelete.id)
						}
						variant="destructive"
					>
						{t("actions.delete")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
