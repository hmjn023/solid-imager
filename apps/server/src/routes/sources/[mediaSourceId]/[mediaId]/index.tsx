import type { UUID } from "@solid-imager/core/domain/shared/schemas";
import { useParams } from "@solidjs/router";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Match, onCleanup, onMount, Switch } from "solid-js";
import MediaSidebar from "~/components/media/media-sidebar";
import MediaViewer from "~/components/media/media-viewer";
import { fetchMediaDetails } from "~/infrastructure/api-clients/media-api";

export default function Media() {
  const params = useParams();
  const queryClient = useQueryClient();
  const mediaSourceId = params.mediaSourceId as UUID;
  const mediaId = params.mediaId as UUID;

  const mediaDetails = createQuery(() => ({
    queryKey: ["mediaDetails", mediaSourceId, mediaId],
    queryFn: () => fetchMediaDetails(mediaSourceId, mediaId),
  }));

  const handleUpdate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["mediaDetails", mediaSourceId, mediaId],
    });
  };

  onMount(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.mediaId === mediaId) {
          handleUpdate();
        }
      } catch {
        // Ignore JSON parse errors for non-matching events
      }
    };

    onCleanup(() => {
      eventSource.close();
    });
  });

  return (
    <div class="container mx-auto p-4">
      <Switch>
        {/* <Match when={mediaDetails.isLoading}>
          <div>Loading media...</div>
        </Match> */}
        <Match when={mediaDetails.isError}>
          <div class="text-red-500">Error: {mediaDetails.error?.message}</div>
        </Match>
        <Match when={mediaDetails.data}>
          {(details) => (
            <div class="flex h-[calc(100vh-80px)] flex-col gap-4 lg:flex-row">
              <div class="flex-grow">
                <MediaViewer media={details()} />
              </div>
              <div class="w-full shrink-0 lg:w-96">
                <MediaSidebar
                  isUpdating={mediaDetails.isRefetching}
                  media={details()}
                  onUpdate={handleUpdate}
                />
              </div>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
}
