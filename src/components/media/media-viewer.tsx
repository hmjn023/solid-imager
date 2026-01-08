import { useParams } from "@solidjs/router";
import { createMemo, Match, Switch } from "solid-js";
import { isServer } from "solid-js/web";
import type { MediaDetails } from "~/domain/media/schemas";

type MediaViewerProps = {
  media: MediaDetails;
};

export default function MediaViewer(props: MediaViewerProps) {
  const params = useParams();

  const mediaUrl = createMemo(() => {
    const url = `/api/sources/${params.mediaSourceId}/${params.mediaId}`;
    const fullUrl = isServer ? `http://localhost:3000${url}` : url;
    return fullUrl;
  });

  return (
    <div class="flex h-full w-full items-center justify-center bg-black/5">
      <Switch>
        <Match when={props.media.mediaType === "video"}>
          {/* biome-ignore lint/a11y/useMediaCaption: Tracks are not yet implemented */}
          <video
            class="max-h-full max-w-full"
            controls
            height={props.media.height}
            src={mediaUrl()}
            width={props.media.width}
          >
            Your browser does not support the video tag.
          </video>
        </Match>
        <Match when={props.media.mediaType === "audio"}>
          {/* biome-ignore lint/a11y/useMediaCaption: Tracks are not yet implemented */}
          <audio controls src={mediaUrl()}>
            Your browser does not support the audio tag.
          </audio>
        </Match>
        <Match when={true}>
          {/* biome-ignore lint/performance/noImgElement: SolidStart does not have a dedicated Image component like Next.js */}
          <img
            alt={props.media.fileName}
            class="max-h-full max-w-full object-contain"
            height={props.media.height}
            src={mediaUrl()}
            width={props.media.width}
          />
        </Match>
      </Switch>
    </div>
  );
}
