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
      connectionInfo: props.editingSource?.connectionInfo || {
        // Default based on type, but for initial load simple defaults
        path: "",
        url: "",
        username: "",
        password: "",
        // S3 defaults
        region: "",
        bucket: "",
        accessKeyId: "",
        secretAccessKey: "",
        // SFTP defaults
        host: "",
        port: 22,
        remotePath: "",
      },
    },
    onSubmit: async ({ value }) => {
      // Clean up connectionInfo based on type to match schema
      let connectionInfo = {};
      if (value.type === "local") {
        connectionInfo = { path: (value.connectionInfo as any).path };
      } else if (value.type === "nextcloud") {
        connectionInfo = {
          url: (value.connectionInfo as any).url,
          username: (value.connectionInfo as any).username,
          password: (value.connectionInfo as any).password,
        };
      } else if (value.type === "s3") {
        connectionInfo = {
            region: (value.connectionInfo as any).region,
            bucket: (value.connectionInfo as any).bucket,
            accessKeyId: (value.connectionInfo as any).accessKeyId,
            secretAccessKey: (value.connectionInfo as any).secretAccessKey,
            prefix: (value.connectionInfo as any).prefix,
        };
      } else if (value.type === "sftp") {
        connectionInfo = {
            host: (value.connectionInfo as any).host,
            port: Number((value.connectionInfo as any).port),
            username: (value.connectionInfo as any).username,
            password: (value.connectionInfo as any).password,
            privateKey: (value.connectionInfo as any).privateKey,
            remotePath: (value.connectionInfo as any).remotePath,
        };
      }

      const submissionData = {
        ...value,
        connectionInfo,
        id: props.editingSource?.id,
        description: value.description || null,
      };

      await props.onSubmit(submissionData as unknown as MediaSourceInfo);
      props.onClose();
    },
    validatorAdapter: zodValidator(),
    validators: {
      onChange: mediaSourceInfoSchema,
    },
  }));

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto py-10">
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
                      <option value="nextcloud">Nextcloud (WebDAV)</option>
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

            <form.Subscribe
                selector={(state) => state.values.type}
            >
                {(type) => (
                    <>
                        <Show when={type() === "local"}>
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
                                        placeholder="Enter directory path"
                                        type="text"
                                        value={field().state.value as string || ""}
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
                        </Show>

                        <Show when={type() === "nextcloud"}>
                             <div class="space-y-4">
                                <div>
                                    <form.Field name="connectionInfo.url">
                                        {(field) => (
                                        <>
                                            <label
                                            class="mb-1 block font-medium text-sm"
                                            for="source-url"
                                            >
                                            WebDAV URL
                                            </label>
                                            <input
                                            class="w-full rounded-md border border-gray-300 px-3 py-2"
                                            id="source-url"
                                            onInput={(e) => field().handleChange(e.target.value)}
                                            placeholder="https://nextcloud.example.com/remote.php/dav/files/user/"
                                            type="text"
                                            value={field().state.value as string || ""}
                                            />
                                        </>
                                        )}
                                    </form.Field>
                                </div>
                                <div>
                                    <form.Field name="connectionInfo.username">
                                        {(field) => (
                                        <>
                                            <label
                                            class="mb-1 block font-medium text-sm"
                                            for="source-username"
                                            >
                                            Username
                                            </label>
                                            <input
                                            class="w-full rounded-md border border-gray-300 px-3 py-2"
                                            id="source-username"
                                            onInput={(e) => field().handleChange(e.target.value)}
                                            placeholder="Username"
                                            type="text"
                                            value={field().state.value as string || ""}
                                            />
                                        </>
                                        )}
                                    </form.Field>
                                </div>
                                <div>
                                    <form.Field name="connectionInfo.password">
                                        {(field) => (
                                        <>
                                            <label
                                            class="mb-1 block font-medium text-sm"
                                            for="source-password"
                                            >
                                            Password / App Password
                                            </label>
                                            <input
                                            class="w-full rounded-md border border-gray-300 px-3 py-2"
                                            id="source-password"
                                            onInput={(e) => field().handleChange(e.target.value)}
                                            placeholder="Password"
                                            type="password"
                                            value={field().state.value as string || ""}
                                            />
                                        </>
                                        )}
                                    </form.Field>
                                </div>
                            </div>
                        </Show>
                    </>
                )}
            </form.Subscribe>

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
