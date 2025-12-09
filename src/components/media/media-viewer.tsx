import { useParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import { isServer } from "solid-js/web";
import type { MediaDetails } from "~/domain/media/schemas";

type MediaViewerProps = {
  media: MediaDetails;
};

export default function MediaViewer(props: MediaViewerProps) {
  const params = useParams();

  const imageUrl = createMemo(() => {
    const url = `/api/sources/${params.mediaSourceId}/${params.mediaId}`;
    const fullUrl = isServer ? `http://localhost:3000${url}` : url;
    return fullUrl;
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
