import { useParams } from "@solidjs/router";
import { createResource, Match, Switch } from "solid-js";
import MediaSidebar from "~/components/media/media-sidebar";
import MediaViewer from "~/components/media/media-viewer";
import type { UUID } from "~/domain/shared/schemas";
import { fetchMediaDetails } from "~/infrastructure/api-clients/media-api";

export default function Media() {
  const params = useParams();
  const mediaSourceId = params.mediaSourceId as UUID;
  const mediaId = params.mediaId as UUID;

  const [mediaDetails, { refetch }] = createResource(() =>
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
                <MediaSidebar media={details()} onUpdate={refetch} />
              </div>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
}
