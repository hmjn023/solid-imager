import { useParams } from "@solidjs/router";
import { createResource, Match, Switch } from "solid-js";
import { isServer } from "solid-js/web";
import MediaSidebar from "~/components/media/media-sidebar";
import MediaViewer from "~/components/media/media-viewer";
import type { MediaDetails } from "~/domain/media/schemas";
import type { UUID } from "~/domain/shared/schemas";

async function fetchMediaDetails(
  mediaSourceId: UUID,
  mediaId: UUID
): Promise<MediaDetails> {
  const url = `/api/sources/${mediaSourceId}/${mediaId}/details`;
  const fullUrl = isServer ? `http://localhost:3000${url}` : url;

  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch media details");
  }
  return response.json();
}

export default function Media() {
  const params = useParams();
  const mediaSourceId = params.mediaSourceId;
  const mediaId = params.mediaId;

  const [mediaDetails] = createResource(() =>
    fetchMediaDetails(mediaSourceId, mediaId)
  );

  return (
    <div class="container mx-auto p-4">
      <Switch>
        {/* <Match when={mediaDetails.loading}>
          <div>Loading media...</div>
        </Match> */}
        <Match when={mediaDetails.error}>
          <div class="text-red-500">Error: {mediaDetails.error.message}</div>
        </Match>
        <Match when={mediaDetails()}>
          {(details) => (
            <div class="flex h-[calc(100vh-80px)] flex-col gap-4 lg:flex-row">
              <div class="flex-grow">
                <MediaViewer media={details()} />
              </div>
              <div class="w-full shrink-0 lg:w-96">
                <MediaSidebar media={details()} />
              </div>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
}
