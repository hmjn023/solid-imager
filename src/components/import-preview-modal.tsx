import { createResource, createSignal, For, Show } from "solid-js";
import { toast } from "solid-toast";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { Button } from "./ui/button";

type ImportPreviewModalProps = {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
  onApproved?: () => void;
};

type ImportItemPayload = {
  imageUrl: string;
  description?: string;
  author?: {
    name: string;
    accountId?: string | null;
  };
  tags?: Array<{ name: string; type: string }>;
};

const MAX_VISIBLE_TAGS = 3;
const DEFAULT_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Modal for previewing and approving items from a bulk import job.
 */
export default function ImportPreviewModal(props: ImportPreviewModalProps) {
  const [selectedIndices, setSelectedIndices] = createSignal<number[]>([]);

  // Fetch job details using oRPC
  const [job] = createResource(
    () => (props.isOpen ? props.jobId : null),
    async (id) => {
      const data = await orpc.downloads.getPending({ jobId: id });
      // Initialize all items as selected
      const payload = data.payload as { items?: ImportItemPayload[] };
      if (payload?.items) {
        setSelectedIndices(payload.items.map((_, i) => i));
      }
      return data;
    }
  );

  const toggleSelect = (index: number) => {
    const current = selectedIndices();
    if (current.includes(index)) {
      setSelectedIndices(current.filter((i) => i !== index));
    } else {
      setSelectedIndices([...current, index]);
    }
  };

  const handleApprove = async () => {
    const currentJob = job();
    if (!currentJob) {
      return;
    }

    try {
      await orpc.downloads.approve({
        jobId: props.jobId,
        selectedIndices: selectedIndices(),
        mediaSourceId: (currentJob.mediaSourceId as string) || DEFAULT_ID,
      });

      toast.success(`Approved ${selectedIndices().length} items for download`);
      props.onApproved?.();
      props.onClose();
    } catch (_error) {
      toast.error("Failed to approve items");
    }
  };

  const items = () =>
    (job()?.payload as { items?: ImportItemPayload[] })?.items || [];

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div class="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
          <div class="flex items-center justify-between border-b p-4">
            <h2 class="font-bold text-xl">Import Preview</h2>
            <button
              class="text-gray-500 hover:text-gray-700"
              onClick={props.onClose}
              type="button"
            >
              ✕
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <Show fallback={<p>Loading preview...</p>} when={!job.loading}>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                <For each={items()}>
                  {(item, index) => (
                    // biome-ignore lint/a11y/useSemanticElements: UI choice
                    // biome-ignore lint/a11y/noStaticElementInteractions: UI choice
                    // biome-ignore lint/a11y/useKeyWithClickEvents: UI choice
                    <div
                      class={`relative flex cursor-pointer flex-col rounded border p-2 ${selectedIndices().includes(index()) ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
                      onClick={() => toggleSelect(index())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          toggleSelect(index());
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div class="absolute top-2 left-2 z-10">
                        <input
                          checked={selectedIndices().includes(index())}
                          class="h-4 w-4"
                          readOnly
                          type="checkbox"
                        />
                      </div>
                      {/* biome-ignore lint/performance/noImgElement: External URL */}
                      {/* biome-ignore lint/nursery/useImageSize: Dynamic URL */}
                      <img
                        alt=""
                        class="mb-2 aspect-video w-full rounded bg-gray-100 object-cover"
                        height={225}
                        src={item.imageUrl}
                        width={400}
                      />
                      <div class="flex-1 text-xs">
                        <p class="line-clamp-2 font-medium">
                          {item.description || "No description"}
                        </p>
                        <p class="mt-1 truncate text-gray-500">
                          {item.author?.name || "Unknown Author"}
                        </p>
                        <div class="mt-2 flex flex-wrap gap-1">
                          <For each={item.tags?.slice(0, MAX_VISIBLE_TAGS)}>
                            {(tag) => (
                              <span class="rounded bg-gray-200 px-1 py-0.5 text-[10px]">
                                {tag.name}
                              </span>
                            )}
                          </For>
                          <Show
                            when={(item.tags?.length || 0) > MAX_VISIBLE_TAGS}
                          >
                            <span class="text-[10px] text-gray-400">
                              +{(item.tags?.length || 0) - MAX_VISIBLE_TAGS}
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="flex items-center justify-between border-t p-4">
            <p class="text-gray-600 text-sm">
              {selectedIndices().length} of {items().length} items selected
            </p>
            <div class="flex gap-2">
              <Button onClick={props.onClose} variant="outline">
                Cancel
              </Button>
              <Button
                disabled={selectedIndices().length === 0 || job.loading}
                onClick={handleApprove}
              >
                Import Selected
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
