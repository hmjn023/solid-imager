import { useParams } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";
import type { UUID } from "~/domain/shared/types";
import { getMedia } from "~/infrastructure/api-clients/media";

function fetchMedia(sourceId: UUID, mediaId: UUID) {
  return getMedia(sourceId, mediaId);
}

export default function Media() {
  const params = useParams();
  const mediaParams = createMemo(() => ({
    sourceId: params.mediaSourceId as UUID,
    mediaId: params.mediaId as UUID,
  }));

  const [media] = createResource(mediaParams, ({ sourceId, mediaId }) =>
    fetchMedia(sourceId, mediaId)
  );

  return (
    <div class="container mx-auto p-4">
      <Show when={media.loading}>
        <div>Loading media...</div>
      </Show>
      <Show when={media.error}>
        <div class="text-red-500">Error: {media.error.message}</div>
      </Show>
      <Show when={media()}>
        {(item) => (
          <div class="flex justify-center">
            {/* biome-ignore lint/performance/noImgElement: SolidStart does not have a dedicated Image component like Next.js */}
            <img
              alt={item.fileName}
              height={item.height}
              src={`/api/sources/${params.mediaSourceId}/${params.mediaId}`}
              width={item.width}
            />
          </div>
        )}
      </Show>
    </div>
  );
}
