import { useSourceRootPath } from "@solid-imager/ui/hooks/use-source-root-path";
import { projectsQueryKeys } from "@solid-imager/ui/query-options";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import { MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createTauriTransport } from "~/hooks/use-media-source-events";
import { mediaDetailsQueryOptions, mediaSourcesQueryOptions } from "~/queries";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	loader: ({ context, params }) => {
		void context.queryClient.prefetchQuery(mediaSourcesQueryOptions());
		void context.queryClient.prefetchQuery(
			mediaDetailsQueryOptions(params.mediaSourceId, params.mediaId),
		);
	},
	pendingComponent: () => (
		<RouteDataPendingScreen
			description="メディア詳細を準備しています..."
			layout="media-detail"
			showDescription
			title="メディア詳細"
		/>
	),
	component: MediaDetailRoute,
});

function MediaDetailRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });
	const queryClient = useQueryClient();
	const mediaSourceId = () => params().mediaSourceId;
	const mediaId = () => params().mediaId;

	const sourceRootPathResolver = useSourceRootPath(mediaSourcesQueryOptions);

	return (
		<MediaDetailScreen
			mediaDetailsQueryOptions={mediaDetailsQueryOptions}
			mediaId={mediaId()}
			mediaSourceId={mediaSourceId()}
			onAdditionalInvalidate={async () => {
				await queryClient.invalidateQueries({
					queryKey: projectsQueryKeys.forMedia(mediaId()),
				});
			}}
			renderMediaSidebar={(media, isUpdating, onUpdate, srp) => (
				<MediaSidebar
					isUpdating={isUpdating}
					media={media}
					onUpdate={onUpdate}
					sourceRootPath={srp}
				/>
			)}
			renderMediaViewer={(media, srp) => (
				<MediaViewer media={media} sourceRootPath={srp} />
			)}
			sourceRootPath={sourceRootPathResolver(mediaSourceId())}
			transport={createTauriTransport(mediaSourceId)}
		/>
	);
}
