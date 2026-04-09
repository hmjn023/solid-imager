import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import { Match, Switch } from "solid-js";
import { MediaSidebar } from "../../../../components/media/media-sidebar";
import { MediaViewer } from "../../../../components/media/media-viewer";
import { useMediaSourceEvents } from "../../../../hooks/use-media-source-events";
import { orpc } from "../../../../infrastructure/api-clients/orpc-client";
import { mediaDetailsQueryOptions } from "../../../../infrastructure/api-clients/queries/media-query";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	loader: async ({ context, params }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(
				mediaDetailsQueryOptions(params.mediaSourceId, params.mediaId),
			),
			context.queryClient.ensureQueryData({
				queryKey: ["mediaSource", params.mediaSourceId],
				queryFn: () => orpc.sources.get({ id: params.mediaSourceId }),
			}),
		]);
	},
	component: MediaDetailRoute,
});

function MediaDetailRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });
	const queryClient = useQueryClient();
	const mediaSourceId = () => params().mediaSourceId;
	const mediaId = () => params().mediaId;

	const mediaDetails = createQuery(() =>
		mediaDetailsQueryOptions(mediaSourceId(), mediaId()),
	);
	const mediaSource = createQuery(() => ({
		queryKey: ["mediaSource", mediaSourceId()],
		queryFn: () => orpc.sources.get({ id: mediaSourceId() }),
	}));

	const sourceRootPath = () => {
		const source = mediaSource.data as SafeMediaSource | undefined;
		if (source?.type !== "local") {
			return undefined;
		}
		const connectionInfo = source.connectionInfo as { path?: string };
		return connectionInfo.path;
	};

	const handleUpdate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: ["mediaDetails", mediaSourceId(), mediaId()],
			}),
			queryClient.invalidateQueries({
				queryKey: ["projectsForMedia", mediaId()],
			}),
		]);
	};

	useMediaSourceEvents(mediaSourceId, {
		onMediaAdded: () => {
			void queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
		},
		onMediaDeleted: (data) => {
			void queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
			if (
				data.mediaId === mediaId() ||
				data.filePath === mediaDetails.data?.filePath
			) {
				void handleUpdate();
			}
		},
		onMediaChanged: (data) => {
			void queryClient.invalidateQueries({
				queryKey: ["media", mediaSourceId()],
			});
			if (
				data.mediaId === mediaId() ||
				data.filePath === mediaDetails.data?.filePath
			) {
				void handleUpdate();
			}
		},
		onThumbnailGenerated: (data) => {
			if (data.mediaId === mediaId()) {
				void handleUpdate();
			}
		},
	});

	return (
		<div class="container mx-auto p-4">
			<Switch>
				<Match when={mediaDetails.isError}>
					<div class="text-red-500">Error: {mediaDetails.error?.message}</div>
				</Match>
				<Match when={mediaDetails.data}>
					{(details) => (
						<div class="flex h-[calc(100vh-80px)] flex-col gap-4 lg:flex-row">
							<div class="flex-grow">
								<MediaViewer
									media={details()}
									sourceRootPath={sourceRootPath()}
								/>
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
