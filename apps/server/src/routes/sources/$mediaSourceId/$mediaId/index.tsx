import type { UUID } from "@solid-imager/core/domain/shared/schemas";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import MediaSidebar from "~/components/media/media-sidebar";
import MediaViewer from "~/components/media/media-viewer";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries/media-query";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
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
	const mediaSourceId = () => params().mediaSourceId as UUID;
	const mediaId = () => params().mediaId as UUID;

	return (
		<MediaDetailScreen
			mediaDetailsQueryOptions={mediaDetailsQueryOptions}
			mediaId={mediaId()}
			mediaSourceId={mediaSourceId()}
			renderMediaSidebar={(media, isUpdating, onUpdate) => (
				<MediaSidebar
					isUpdating={isUpdating}
					media={media}
					onUpdate={onUpdate}
				/>
			)}
			renderMediaViewer={(media) => <MediaViewer media={media} />}
			transport={createServerTransport(mediaSourceId)}
		/>
	);
}
