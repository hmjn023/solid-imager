import type { Media } from "@solid-imager/core/domain/media/schemas";
import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";

type MediaCardItemProps = {
  media: Media;
  /**
   * If true, a checkbox will be displayed for selection.
   */
  selectable?: boolean;
  /**
   * Whether the item is currently selected.
   */
  selected?: boolean;
  /**
   * Callback when selection is toggled.
   */
  onToggle?: (id: string) => void;
  /**
   * Optional priority loading for the image.
   */
  priority?: boolean;
};

export function MediaCardItem(props: MediaCardItemProps) {
  const thumbnailUrl = () =>
    `/api/sources/${props.media.mediaSourceId}/${props.media.id}/thumbnail?t=${new Date(
      props.media.modifiedAt
    ).getTime()}`;

  const fileSizeStr = () => {
    if (!props.media.fileSize) {
      return "N/A";
    }
    const BytesToKb = 1024;
    return `${(props.media.fileSize / BytesToKb).toFixed(1)} KB`;
  };

  const dimensionsStr = () =>
    props.media.width && props.media.height
      ? `${props.media.width}×${props.media.height} `
      : "N/A";

  return (
    <Card
      class={`overflow-hidden shadow shadow-lg transition-shadow hover:shadow-lg ${
        props.selected ? "ring-2 ring-primary" : ""
      }`}
      onClick={() => props.selectable && props.onToggle?.(props.media.id)}
    >
      <div class="group relative">
        <div class="flex aspect-video w-full items-center justify-center overflow-hidden bg-gray-100">
          <Show
            fallback={<div class="text-gray-400">{props.media.mediaType}</div>}
            when={props.media.mediaType === "image"}
          >
            {/* biome-ignore lint/performance/noImgElement: Standard img for simplicity */}
            <img
              alt={props.media.fileName}
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              height={props.media.height}
              loading={props.priority ? "eager" : "lazy"}
              src={thumbnailUrl()}
              width={props.media.width}
            />
          </Show>
        </div>

        <Show when={props.selectable}>
          <div class="absolute top-2 right-2 z-10">
            <Checkbox
              checked={props.selected}
              class="h-5 w-5 rounded border-gray-300 bg-white text-primary shadow-sm focus:ring-primary"
              // The card onClick handles toggle, so we can stop propagation here or just let it bubble
              // But Checkbox implementation might consume click.
              // Let's rely on card click for now, but ensure checkbox reflects state.
            />
          </div>
        </Show>
      </div>

      <div class="space-y-1 p-3">
        <h3 class="truncate font-semibold text-sm" title={props.media.fileName}>
          {props.media.fileName}
        </h3>
        <p
          class="truncate text-muted-foreground text-xs"
          title={props.media.filePath}
        >
          {props.media.filePath}
        </p>
        <div class="flex justify-between pt-1 text-muted-foreground text-xs">
          <span>{dimensionsStr()}</span>
          <span>{fileSizeStr()}</span>
        </div>

        <Show when={!props.selectable}>
          <A
            class="mt-2 block text-center text-primary text-sm hover:underline"
            href={`/sources/${props.media.mediaSourceId}/${props.media.id}`}
            onClick={(e) => e.stopPropagation()} // Prevent card click if we had one
          >
            Check Details
          </A>
        </Show>
      </div>
    </Card>
  );
}
