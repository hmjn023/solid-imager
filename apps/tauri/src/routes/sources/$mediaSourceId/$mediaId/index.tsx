import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import { MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createTauriTransport } from "~/hooks/use-media-source-events";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries/media-query";

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

	return (
		<MediaDetailScreen
			mediaDetailsQueryOptions={mediaDetailsQueryOptions}
			mediaId={mediaId()}
			mediaSourceId={mediaSourceId()}
			onAdditionalInvalidate={async () => {
				await queryClient.invalidateQueries({
					queryKey: ["projectsForMedia", mediaId()],
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
			sourceRootPath={sourceRootPath()}
			transport={createTauriTransport(mediaSourceId)}
		/>
	);
}
