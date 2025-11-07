import { Collapsible } from "@kobalte/core";
import { createMemo, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import type { MediaDetails } from "~/domain/media/schemas";

type MediaSidebarProps = {
  media: MediaDetails;
};

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

const CodeBlock = (props: { content: string }) => (
  <pre class="mt-2 max-h-96 overflow-y-auto rounded-md bg-gray-100 p-2">
    <code class="text-sm">{props.content}</code>
  </pre>
);

const CollapsibleSection = (props: {
  title: string;
  content: string | object;
}) => {
  const isJson = typeof props.content === "object" && props.content !== null;
  const formattedContent = isJson
    ? JSON.stringify(props.content, null, 2)
    : (props.content as string);

  return (
    <Collapsible.Root class="w-full">
      <Collapsible.Trigger class="w-full cursor-pointer rounded-md bg-gray-200 px-3 py-2 text-left font-medium hover:bg-gray-300">
        {props.title}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <CodeBlock content={formattedContent} />
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

export default function MediaSidebar(props: MediaSidebarProps) {
  const tags = createMemo(() => props.media.tags || []);

  const positiveTags = createMemo(() =>
    tags().filter((tag) => tag.type === "positive")
  );

  const negativeTags = createMemo(() =>
    tags().filter((tag) => tag.type === "negative")
  );

  const genInfo = createMemo(() => props.media.generationInfo);

  return (
    <aside class="h-full space-y-4 overflow-y-auto rounded-lg border bg-gray-50 p-4">
      <div>
        <h1 class="text-xl font-bold">{props.media.fileName}</h1>
        <p class="text-sm text-gray-500">{props.media.filePath}</p>
      </div>

      <div class="space-y-2">
        <h2 class="text-lg font-semibold">Details</h2>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt class="font-medium text-gray-600">Resolution</dt>
          <dd class="text-gray-800">
            {props.media.width} x {props.media.height}
          </dd>
          <dt class="font-medium text-gray-600">File Size</dt>
          <dd class="text-gray-800">
            {props.media.fileSize ? formatBytes(props.media.fileSize) : "N/A"}
          </dd>
        </dl>
      </div>

      <Show when={positiveTags().length > 0}>
        <div class="space-y-2">
          <h2 class="text-lg font-semibold">Positive Tags</h2>
          <div class="flex flex-wrap gap-2">
            <For each={positiveTags()}>
              {(tag) => <Badge>{tag.name}</Badge>}
            </For>
          </div>
        </div>
      </Show>

      <Show when={negativeTags().length > 0}>
        <div class="space-y-2">
          <h2 class="text-lg font-semibold">Negative Tags</h2>
          <div class="flex flex-wrap gap-2">
            <For each={negativeTags()}>
              {(tag) => <Badge variant="destructive">{tag.name}</Badge>}
            </For>
          </div>
        </div>
      </Show>

      <Show when={genInfo()}>
        {(info) => (
          <div class="space-y-2">
            <h2 class="text-lg font-semibold">Generation Info</h2>
            <Show when={info.prompt}>
              <CollapsibleSection title="Prompt" content={info.prompt!} />
            </Show>
            <Show when={info.negativePrompt}>
              <CollapsibleSection
                title="Negative Prompt"
                content={info.negativePrompt!}
              />
            </Show>
            <Show when={info.workflow}>
              <CollapsibleSection title="Workflow" content={info.workflow!} />
            </Show>
          </div>
        )}
      </Show>
    </aside>
  );
}
