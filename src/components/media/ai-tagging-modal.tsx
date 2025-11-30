import { createSignal, For, Show, createEffect } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import type { TaggingResponse } from "~/domain/tagging/schemas";

type AITaggingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mediaSourceId: string;
  mediaId: string;
};

export default function AITaggingModal(props: AITaggingModalProps) {
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
      const response = await fetch("/api/ai/tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaSourceId: props.mediaSourceId,
          mediaId: props.mediaId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
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
              <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
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
                  <h3 class="font-semibold text-lg mb-2">Characters</h3>
                  <Show
                    when={Object.keys(res().character).length > 0}
                    fallback={<p class="text-gray-500 text-sm">No characters detected.</p>}
                  >
                    <div class="flex flex-wrap gap-2">
                      <For each={Object.entries(res().character)}>
                        {([name, score]) => (
                          <Badge variant="outline" class="flex gap-1">
                            <span>{name}</span>
                            <span class="text-xs opacity-70">
                              ({(score * 100).toFixed(1)}%)
                            </span>
                          </Badge>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* IPs */}
                <div>
                  <h3 class="font-semibold text-lg mb-2">IPs (Series)</h3>
                  <Show
                    when={res().ips.length > 0}
                    fallback={<p class="text-gray-500 text-sm">No IPs detected.</p>}
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
                  <h3 class="font-semibold text-lg mb-2">General Tags</h3>
                  <div class="flex flex-wrap gap-2">
                    <For each={Object.entries(res().general)}>
                      {([name, score]) => (
                        <Badge variant="default" class="flex gap-1 bg-gray-100 text-gray-800 hover:bg-gray-200">
                          <span>{name}</span>
                          <span class="text-xs opacity-70">
                            ({(score * 100).toFixed(1)}%)
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
