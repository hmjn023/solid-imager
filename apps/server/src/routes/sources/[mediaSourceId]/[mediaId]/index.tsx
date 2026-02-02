import type { UUID } from "@solid-imager/core/domain/shared/schemas";
import { useParams } from "@solidjs/router";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import MediaSidebar from "~/components/media/media-sidebar";
import MediaViewer from "~/components/media/media-viewer";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
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

  useMediaSourceEvents(() => mediaSourceId, {
    onMediaAdded: () => {
      // New media added to source, invalidate list cache
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId],
      });
    },
    onMediaDeleted: (data) => {
      // Media deleted from source
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId],
      });
      // If current media is deleted, invalidate details to show error
      if (
        (data as { filePath: string }).filePath === mediaDetails.data?.filePath
      ) {
        handleUpdate();
      }
    },
    onMediaChanged: (data) => {
      // If current media changed, update
      if (
        (data as { filePath: string }).filePath === mediaDetails.data?.filePath
      ) {
        handleUpdate();
      }
    },
    onThumbnailGenerated: (data) => {
      // Thumbnail might affect current view if it was missing
      if ((data as { mediaId: string }).mediaId === mediaId) {
        handleUpdate();
      }
    },
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
