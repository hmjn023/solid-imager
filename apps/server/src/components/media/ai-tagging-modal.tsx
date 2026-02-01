import type { TaggingResponse } from "@solid-imager/core/domain/tagging/schemas";
import { createEffect, createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { fetchAiTags } from "~/infrastructure/api-clients/ai-api";

type AiTaggingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mediaSourceId: string;
  mediaId: string;
};

const PERCENTAGE_MULTIPLIER = 100;

export default function AiTaggingModal(props: AiTaggingModalProps) {
  const [isLoading, setIsLoading] = createSignal(false);
  const [result, setResult] = createSignal<TaggingResponse | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen) {
      fetchTags();
    } else {
      // Reset state when closed
      setResult(null);
      setError(null);
      setIsLoading(false);
    }
  });

  const fetchTags = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAiTags({
        mediaSourceId: props.mediaSourceId,
        mediaId: props.mediaId,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => !open && props.onClose()}
      open={props.isOpen}
    >
      <DialogContent class="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>AI Tagging Results</DialogTitle>
          <DialogDescription>
            Tags extracted from the image using the AI service.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4">
          <Show when={isLoading()}>
            <div class="flex items-center justify-center py-8">
              <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <span class="ml-2 text-gray-600">Analyzing image...</span>
            </div>
          </Show>

          <Show when={error()}>
            <div class="rounded-md bg-red-50 p-4 text-red-600">
              Error: {error()}
            </div>
          </Show>

          <Show when={result()}>
            {(res) => (
              <div class="space-y-6">
                {/* Characters */}
                <div>
                  <h3 class="mb-2 font-semibold text-lg">Characters</h3>
                  <Show
                    fallback={
                      <p class="text-gray-500 text-sm">
                        No characters detected.
                      </p>
                    }
                    when={Object.keys(res().character).length > 0}
                  >
                    <div class="flex flex-wrap gap-2">
                      <For each={Object.entries(res().character)}>
                        {([name, score]) => (
                          <Badge class="flex gap-1" variant="outline">
                            <span>{name}</span>
                            <span class="text-xs opacity-70">
                              ({(score * PERCENTAGE_MULTIPLIER).toFixed(1)}%)
                            </span>
                          </Badge>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* IPs */}
                <div>
                  <h3 class="mb-2 font-semibold text-lg">IPs (Series)</h3>
                  <Show
                    fallback={
                      <p class="text-gray-500 text-sm">No IPs detected.</p>
                    }
                    when={res().ips.length > 0}
                  >
                    <div class="flex flex-wrap gap-2">
                      <For each={res().ips}>
                        {(ip) => <Badge variant="secondary">{ip}</Badge>}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* General Tags */}
                <div>
                  <h3 class="mb-2 font-semibold text-lg">General Tags</h3>
                  <div class="flex flex-wrap gap-2">
                    <For each={Object.entries(res().general)}>
                      {([name, score]) => (
                        <Badge
                          class="flex gap-1 bg-gray-100 text-gray-800 hover:bg-gray-200"
                          variant="default"
                        >
                          <span>{name}</span>
                          <span class="text-xs opacity-70">
                            ({(score * PERCENTAGE_MULTIPLIER).toFixed(1)}%)
                          </span>
                        </Badge>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  );
}
