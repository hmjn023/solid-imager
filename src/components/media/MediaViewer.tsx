import { useParams } from "@solidjs/router";
import type { MediaDetails } from "~/domain/media/schemas";

type MediaViewerProps = {
  media: MediaDetails;
};

export default function MediaViewer(props: MediaViewerProps) {
  const params = useParams();

  return (
    <div class="flex h-full w-full items-center justify-center">
      {/* biome-ignore lint/performance/noImgElement: SolidStart does not have a dedicated Image component like Next.js */}
      <img
        alt={props.media.fileName}
        class="max-h-full max-w-full object-contain"
        height={props.media.height}
        src={`/api/sources/${params.mediaSourceId}/${props.media.id}`}
        width={props.media.width}
      />
    </div>
  );
}
