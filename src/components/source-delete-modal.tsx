import type { MediaSource } from "~/db/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

type SourceDeleteModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  source?: MediaSource;
  isLoading?: boolean;
};

export default function SourceDeleteModal(props: SourceDeleteModalProps) {
  const handleConfirm = async () => {
    await props.onConfirm();
  };

  return (
    <AlertDialog onOpenChange={props.onOpenChange} open={props.open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Media Source</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{props.source?.name}"? This action
            cannot be undone and will remove all associated media files from the
            database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={props.isLoading}
            onClick={handleConfirm}
          >
            {props.isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
