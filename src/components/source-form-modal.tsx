import { createEffect, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import type { MediaSourceInfo, MediaSourceTypeEnum } from "~/lib/types";

type SourceFormModalProps = {
  isOpen: boolean;
  editingSource?: MediaSourceInfo | null;
  onClose: () => void;
  onSubmit: (sourceData: {
    name: string;
    description: string | null;
    type: MediaSourceTypeEnum;
    connectionInfo: { path: string };
  }) => Promise<void>;
};

export default function SourceFormModal(props: SourceFormModalProps) {
  const [formName, setFormName] = createSignal("");
  const [formPath, setFormPath] = createSignal("");
  const [formDescription, setFormDescription] = createSignal("");
  const [formType, setFormType] = createSignal<MediaSourceTypeEnum>("local");
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Pre-fill form when editing
  const initializeForm = () => {
    const editing = props.editingSource;
    if (editing) {
      setFormName(editing.name);
      setFormDescription(editing.description || "");
      setFormType(editing.type);
      setFormPath(
        typeof editing.connectionInfo === "object" &&
          editing.connectionInfo !== null &&
          "path" in editing.connectionInfo
          ? String(editing.connectionInfo.path)
          : ""
      );
    } else {
      // Reset form for new source
      setFormName("");
      setFormPath("");
      setFormDescription("");
      setFormType("local");
    }
  };

  // Initialize form when modal opens or editing source changes
  createEffect(() => {
    if (props.isOpen) {
      initializeForm();
    }
  });

  const handleSubmit = async () => {
    if (!(formName().trim() && formPath().trim())) {
      return;
    }

    setIsSubmitting(true);
    try {
      const sourceData = {
        name: formName(),
        description: formDescription() || null,
        type: formType(),
        connectionInfo: { path: formPath() },
      };

      await props.onSubmit(sourceData);
      props.onClose();
    } catch (error) {
      alert(`Failed to submit source: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitting(false);
    props.onClose();
  };

  return (
    <Portal>
      {props.isOpen && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 class="mb-4 font-bold text-xl">
              {props.editingSource ? "Edit Media Source" : "Add Media Source"}
            </h2>
            <div class="mb-4 space-y-4">
              <div>
                <label class="mb-1 block font-medium text-sm">Name</label>
                <input
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  onInput={(e) => setFormName(e.currentTarget.value)}
                  placeholder="Enter source name"
                  type="text"
                  value={formName()}
                />
              </div>
              <div>
                <label class="mb-1 block font-medium text-sm">
                  Description
                </label>
                <input
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  onInput={(e) => setFormDescription(e.currentTarget.value)}
                  placeholder="Enter description (optional)"
                  type="text"
                  value={formDescription()}
                />
              </div>
              <div>
                <label class="mb-1 block font-medium text-sm">Type</label>
                <select
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  onChange={(e) =>
                    setFormType(e.currentTarget.value as MediaSourceTypeEnum)
                  }
                  value={formType()}
                >
                  <option value="local">Local</option>
                  <option value="sftp">SFTP</option>
                  <option value="s3">S3</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block font-medium text-sm">Path</label>
                <input
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  onInput={(e) => setFormPath(e.currentTarget.value)}
                  placeholder="Enter file path"
                  type="text"
                  value={formPath()}
                />
              </div>
            </div>
            <div class="flex gap-2">
              <button
                class="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
                disabled={
                  !(formName().trim() && formPath().trim()) || isSubmitting()
                }
                onClick={handleSubmit}
                type="button"
              >
                {isSubmitting()
                  ? "Saving..."
                  : props.editingSource
                    ? "Update"
                    : "Create"}
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
