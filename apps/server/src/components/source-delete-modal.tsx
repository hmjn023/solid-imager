import type {
  MediaSourceInfo,
  SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { Button } from "@solid-imager/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@solid-imager/ui/dialog";

type SourceDeleteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
  sourceToDelete?: MediaSourceInfo | SafeMediaSource | null;
};

export default function SourceDeleteModal(props: SourceDeleteModalProps) {
  return (
    <Dialog onOpenChange={() => props.onClose()} open={props.isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Media Source</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span class="font-bold">{props.sourceToDelete?.name}</span>? This
            action cannot be undone. Files on disk will NOT be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => props.onClose()} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() =>
              props.sourceToDelete?.id &&
              props.onConfirm(props.sourceToDelete.id)
            }
            variant="destructive"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
