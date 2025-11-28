import { createEffect, createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { z } from "zod";
import {
  type MediaSourceInfo,
  type MediaSourceTypeEnum,
  mediaSourceInfoSchema,
} from "~/domain/sources/schemas";

/**
 * Props for the SourceFormModal component.
 * @property {boolean} isOpen - Controls the visibility of the modal.
 * @property {MediaSourceInfo | null} [editingSource] - The media source object being edited, if any.
 * @property {() => void} onClose - Callback function to close the modal.
 * @property {(sourceData: { name: string; description: string | null; type: MediaSourceTypeEnum; connectionInfo: { path: string } }) => Promise<void>} onSubmit - Callback function to handle form submission.
 */
type SourceFormModalProps = {
  isOpen: boolean;
  editingSource?: MediaSourceInfo | null;
  onClose: () => void;
  onSubmit: (
    sourceData: Omit<MediaSourceInfo, "id"> & { id?: string }
  ) => Promise<void>;
};
/**
 * A modal component for adding or editing media sources.
 * It provides a form to input source details like name, description, type, and connection path.
 * Uses Zod for validation consistent with the backend.
 * @param {SourceFormModalProps} props - The properties for the SourceFormModal component.
 * @returns {JSX.Element} The rendered media source form modal.
 */
export default function SourceFormModal(props: SourceFormModalProps) {
  const [formName, setFormName] = createSignal("");
  const [formPath, setFormPath] = createSignal("");
  const [formDescription, setFormDescription] = createSignal("");
  const [formType, setFormType] = createSignal<MediaSourceTypeEnum>("local");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errors, setErrors] = createSignal<z.ZodIssue[]>([]);

  // 編集時にフォームを事前入力します。
  const initializeForm = () => {
    const editing = props.editingSource;
    setErrors([]);
    if (editing) {
      setFormName(editing.name);
      setFormDescription(editing.description || "");
      setFormType(editing.type);
      setFormPath(
        typeof editing.connectionInfo === "object" &&
          editing.connectionInfo !== null &&
          "path" in editing.connectionInfo
          ? String((editing.connectionInfo as { path: string }).path)
          : ""
      );
    } else {
      // 新しいソースのためにフォームをリセットします。
      setFormName("");
      setFormPath("");
      setFormDescription("");
      setFormType("local");
    }
  };

  // モーダルが開くか、編集中のソースが変更されたときにフォームを初期化します。
  createEffect(() => {
    if (props.isOpen) {
      initializeForm();
    }
  });

  const handleSubmit = async () => {
    setErrors([]);
    setIsSubmitting(true);

    // Prepare data for validation
    const sourceData = {
      // If editing, preserve ID (though schema.optional() allows it to be undefined)
      id: props.editingSource?.id,
      name: formName(),
      description: formDescription() || null,
      type: formType(),
      connectionInfo: { path: formPath() },
    };

    // Validate using the shared domain schema
    const result = mediaSourceInfoSchema.safeParse(sourceData);

    if (!result.success) {
      setErrors(result.error.issues);
      setIsSubmitting(false);
      return;
    }

    try {
      // Pass validated data
      await props.onSubmit(result.data);
      props.onClose();
    } catch (_error) {
      // エラー処理 - 本番環境ではトースト通知を表示できます。
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitting(false);
    setErrors([]);
    props.onClose();
  };

  // Helper to find error by path
  const getError = (path: string) => {
    // For nested paths like "connectionInfo.path", we need to handle array or partial matching if needed.
    // But Zod path is array of strings/numbers.
    return errors().find((e) => {
      // Join path array to match dot notation
      const errorPath = e.path.join(".");
      return errorPath === path;
    });
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
                <label class="mb-1 block font-medium text-sm" for="source-name">
                  Name
                </label>
                <input
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  id="source-name"
                  onInput={(e) => setFormName(e.currentTarget.value)}
                  placeholder="Enter source name"
                  type="text"
                  value={formName()}
                />
                <Show when={getError("name")}>
                  {(err) => <p class="text-red-500 text-sm">{err().message}</p>}
                </Show>
              </div>
              <div>
                <label
                  class="mb-1 block font-medium text-sm"
                  for="source-description"
                >
                  Description
                </label>
                <input
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  id="source-description"
                  onInput={(e) => setFormDescription(e.currentTarget.value)}
                  placeholder="Enter description (optional)"
                  type="text"
                  value={formDescription()}
                />
                <Show when={getError("description")}>
                  {(err) => <p class="text-red-500 text-sm">{err().message}</p>}
                </Show>
              </div>
              <div>
                <label class="mb-1 block font-medium text-sm" for="source-type">
                  Type
                </label>
                <select
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  id="source-type"
                  onChange={(e) =>
                    setFormType(e.currentTarget.value as MediaSourceTypeEnum)
                  }
                  value={formType()}
                >
                  <option value="local">Local</option>
                  <option value="sftp">SFTP</option>
                  <option value="s3">S3</option>
                </select>
                <Show when={getError("type")}>
                  {(err) => <p class="text-red-500 text-sm">{err().message}</p>}
                </Show>
              </div>
              <div>
                <label class="mb-1 block font-medium text-sm" for="source-path">
                  Path
                </label>
                <input
                  class="w-full rounded-md border border-gray-300 px-3 py-2"
                  id="source-path"
                  onInput={(e) => setFormPath(e.currentTarget.value)}
                  placeholder="Enter file path"
                  type="text"
                  value={formPath()}
                />
                <Show when={getError("connectionInfo.path")}>
                  {(err) => <p class="text-red-500 text-sm">{err().message}</p>}
                </Show>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                class="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
                disabled={isSubmitting()}
                onClick={() => handleSubmit()}
                type="button"
              >
                {(() => {
                  if (isSubmitting()) {
                    return "Saving...";
                  }
                  if (props.editingSource) {
                    return "Update";
                  }
                  return "Create";
                })()}
              </button>
              <button
                class="rounded bg-gray-500 px-4 py-2 text-white"
                onClick={() => handleClose()}
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
