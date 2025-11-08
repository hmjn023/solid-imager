import { useParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import { getRequestEvent, isServer } from "solid-js/web";
import type { MediaDetails } from "~/domain/media/schemas";

type MediaViewerProps = {
  media: MediaDetails;
};

export default function MediaViewer(props: MediaViewerProps) {
  const params = useParams();

  const imageUrl = createMemo(() => {
    let origin = "";
    if (isServer) {
      const event = getRequestEvent();
      origin = event?.request.url ? new URL(event.request.url).origin : "";
    }
    // return `${origin}/api/sources/${params.mediaSourceId}/${props.media.id}`;
    return `${origin}/api/sources/${params.mediaSourceId}/${params.mediaId}`;
  });

  return (
    <div class="flex h-full w-full items-center justify-center">
      {/* biome-ignore lint/performance/noImgElement: SolidStart does not have a dedicated Image component like Next.js */}
      <img
        alt={props.media.fileName}
        class="max-h-full max-w-full object-contain"
        height={props.media.height}
        src={imageUrl()}
        width={props.media.width}
      />
    </div>
  );
}
