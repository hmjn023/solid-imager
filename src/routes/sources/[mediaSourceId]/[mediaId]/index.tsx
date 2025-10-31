import { useParams } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import type { UUID } from "~/domain/shared/types";
import type { Media as MediaType } from "~/infrastructure/db/schema";

async function fetchMedia(
  sourceId: UUID,
  mediaId: UUID,
  origin: string
): Promise<MediaType> {
  const response = await fetch(
    `${origin}/api/sources/${sourceId}/${mediaId}/details`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch media details");
  }
  return response.json();
}

export default function Media() {
  const params = useParams();
  const mediaParams = createMemo(() => ({
    sourceId: params.mediaSourceId as UUID,
    mediaId: params.mediaId as UUID,
  }));

  const [media] = createResource(mediaParams, ({ sourceId, mediaId }) => {
    const event = getRequestEvent();
    const origin = event?.request.url
      ? new URL(event.request.url).origin
      : "http://localhost:3000";
    return fetchMedia(sourceId, mediaId, origin);
  });

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
