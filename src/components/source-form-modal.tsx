import { createForm } from "@tanstack/solid-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import {
  type MediaSourceInfo,
  type MediaSourceTypeEnum,
  mediaSourceInfoSchema,
} from "~/domain/sources/schemas";

type SourceFormModalProps = {
  isOpen: boolean;
  editingSource?: MediaSourceInfo | null;
  onClose: () => void;
  onSubmit: (
    sourceData: Omit<MediaSourceInfo, "id"> & { id?: string }
  ) => Promise<void>;
};

function SourceFormContent(props: SourceFormModalProps) {
  // Initialize form
  const form = createForm(() => ({
    defaultValues: {
      name: props.editingSource?.name || "",
      description: props.editingSource?.description || "",
      type: props.editingSource?.type || ("local" as MediaSourceTypeEnum),
      connectionInfo: {
        path:
          (props.editingSource?.connectionInfo as { path?: string })?.path ||
          "",
      },
    },
    onSubmit: async ({ value }) => {
      // Transform empty string description to null to match schema
      const submissionData = {
        ...value,
        id: props.editingSource?.id,
        description: value.description || null,
      };
      await props.onSubmit(submissionData as MediaSourceInfo);
      props.onClose();
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: mediaSourceInfoSchema,
    },
  }));

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 class="mb-4 font-bold text-xl">
          {props.editingSource ? "Edit Media Source" : "Add Media Source"}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div class="mb-4 space-y-4">
            <div>
              <form.Field name="name">
                {(field) => (
                  <>
                    <label
                      class="mb-1 block font-medium text-sm"
                      for="source-name"
                    >
                      Name
                    </label>
                    <input
                      class="w-full rounded-md border border-gray-300 px-3 py-2"
                      id="source-name"
                      onInput={(e) => field().handleChange(e.target.value)}
                      placeholder="Enter source name"
                      type="text"
                      value={field().state.value}
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-red-500 text-sm">
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                  </>
                )}
              </form.Field>
            </div>
            <div>
              <form.Field name="description">
                {(field) => (
                  <>
                    <label
                      class="mb-1 block font-medium text-sm"
                      for="source-description"
                    >
                      Description
                    </label>
                    <input
                      class="w-full rounded-md border border-gray-300 px-3 py-2"
                      id="source-description"
                      onInput={(e) => field().handleChange(e.target.value)}
                      placeholder="Enter description (optional)"
                      type="text"
                      value={field().state.value}
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-red-500 text-sm">
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                  </>
                )}
              </form.Field>
            </div>
            <div>
              <form.Field name="type">
                {(field) => (
                  <>
                    <label
                      class="mb-1 block font-medium text-sm"
                      for="source-type"
                    >
                      Type
                    </label>
                    <select
                      class="w-full rounded-md border border-gray-300 px-3 py-2"
                      id="source-type"
                      onChange={(e) =>
                        field().handleChange(
                          e.target.value as MediaSourceTypeEnum
                        )
                      }
                      value={field().state.value}
                    >
                      <option value="local">Local</option>
                      <option value="sftp">SFTP</option>
                      <option value="s3">S3</option>
                    </select>
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-red-500 text-sm">
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                  </>
                )}
              </form.Field>
            </div>
            <div>
              <form.Field name="connectionInfo.path">
                {(field) => (
                  <>
                    <label
                      class="mb-1 block font-medium text-sm"
                      for="source-path"
                    >
                      Path
                    </label>
                    <input
                      class="w-full rounded-md border border-gray-300 px-3 py-2"
                      id="source-path"
                      onInput={(e) => field().handleChange(e.target.value)}
                      placeholder="Enter file path"
                      type="text"
                      value={field().state.value}
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-red-500 text-sm">
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                  </>
                )}
              </form.Field>
            </div>
          </div>
          <div class="flex gap-2">
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {(state) => (
                <button
                  class="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
                  disabled={!state().canSubmit || state().isSubmitting}
                  type="submit"
                >
                  {(() => {
                    if (state().isSubmitting) {
                      return "Saving...";
                    }
                    if (props.editingSource) {
                      return "Update";
                    }
                    return "Create";
                  })()}
                </button>
              )}
            </form.Subscribe>
            <button
              class="rounded bg-gray-500 px-4 py-2 text-white"
              onClick={() => props.onClose()}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SourceFormModal(props: SourceFormModalProps) {
  return (
    <Portal>
      <Show when={props.isOpen}>
        <SourceFormContent {...props} />
      </Show>
    </Portal>
  );
}
