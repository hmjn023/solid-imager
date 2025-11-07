import { useParams } from "@solidjs/router";
import { createMemo, createResource, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import MediaSidebar from "~/components/media/MediaSidebar";
import MediaViewer from "~/components/media/MediaViewer";
import type { MediaDetails } from "~/domain/media/schemas";
import type { UUID } from "~/domain/shared/schemas";

async function fetchMediaDetails(
  mediaSourceId: UUID,
  mediaId: UUID,
  origin: string
): Promise<MediaDetails> {
  const response = await fetch(
    `${origin}/api/sources/${mediaSourceId}/${mediaId}/details`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch media details");
  }
  return response.json();
}

export default function Media() {
  const params = useParams();
  const mediaParams = createMemo(() => ({
    mediaSourceId: params.mediaSourceId as UUID,
    mediaId: params.mediaId as UUID,
  }));

  const [mediaDetails] = createResource(
    mediaParams,
    ({ mediaSourceId, mediaId }) => {
      const event = getRequestEvent();
      const origin = event?.request.url
        ? new URL(event.request.url).origin
        : "http://localhost:3000";
      return fetchMediaDetails(mediaSourceId, mediaId, origin);
    }
  );

  return (
    <div class="container mx-auto p-4">
      <Show when={mediaDetails.loading}>
        <div>Loading media...</div>
      </Show>
      <Show when={mediaDetails.error}>
        <div class="text-red-500">Error: {mediaDetails.error.message}</div>
      </Show>
      <Show when={mediaDetails()}>
        {(details) => (
          <div class="flex h-[calc(100vh-80px)] flex-col gap-4 lg:flex-row">
            <div class="flex-grow">
              <MediaViewer media={details} />
            </div>
            <div class="w-full shrink-0 lg:w-96">
              <MediaSidebar media={details} />
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
