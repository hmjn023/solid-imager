import type { UUID } from "@solid-imager/core/domain/shared/schemas";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import { Match, Switch } from "solid-js";
import MediaSidebar from "~/components/media/media-sidebar";
import MediaViewer from "~/components/media/media-viewer";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries/media-query";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	ssr: true,
	beforeLoad: ({ context }) => {
		void context;
	},
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			mediaDetailsQueryOptions(
				params.mediaSourceId as UUID,
				params.mediaId as UUID,
			),
		);
	},
	component: Media,
});

function Media() {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });
	const queryClient = useQueryClient();
	const mediaSourceId = params().mediaSourceId as UUID;
	const mediaId = params().mediaId as UUID;

	const mediaDetails = createQuery(() =>
		mediaDetailsQueryOptions(mediaSourceId, mediaId),
	);

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
			if (data.filePath === mediaDetails.data?.filePath) {
				handleUpdate();
			}
		},
		onMediaChanged: (data) => {
			// Invalidate list cache as changes might affect sorting/filtering
			queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId],
			});
			// If current media changed, update
			if (data.filePath === mediaDetails.data?.filePath) {
				handleUpdate();
			}
		},
		onThumbnailGenerated: (data) => {
			// Thumbnail might affect current view if it was missing
			if (data.mediaId === mediaId) {
				handleUpdate();
			}
		},
	});

	return (
		<div class="container mx-auto min-h-[calc(100vh-2rem)] p-4 bg-[#131313] text-[#e5e2e1]">
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
