import { createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import type { MediaSourceInfo } from "~/lib/types";

type SourceDeleteModalProps = {
  isOpen: boolean;
  sourceToDelete?: MediaSourceInfo | null;
  onClose: () => void;
  onConfirm: (sourceId: string) => Promise<void>;
};

export default function SourceDeleteModal(props: SourceDeleteModalProps) {
  const [isDeleting, setIsDeleting] = createSignal(false);

  const handleConfirm = async () => {
    const source = props.sourceToDelete;
    if (!source) return;

    setIsDeleting(true);
    try {
      await props.onConfirm(source.id);
      props.onClose();
    } catch (error) {
      console.error("Failed to delete source:", error);
      alert("Failed to delete source: " + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setIsDeleting(false);
    props.onClose();
  };

  return (
    <Portal>
      {props.isOpen && props.sourceToDelete && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 class="mb-4 font-bold text-xl">Delete Media Source</h2>
            <p class="mb-4">
              Are you sure you want to delete "{props.sourceToDelete.name}"? 
              This action cannot be undone and will remove all associated media files from the database.
            </p>
            <div class="flex gap-2">
              <button
                class="rounded bg-red-500 px-4 py-2 text-white disabled:opacity-50"
                disabled={isDeleting()}
                onClick={handleConfirm}
                type="button"
              >
                {isDeleting() ? "Deleting..." : "Delete"}
              </button>
              <button
                class="rounded bg-gray-500 px-4 py-2 text-white"
                onClick={handleClose}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Portal>
  );
}