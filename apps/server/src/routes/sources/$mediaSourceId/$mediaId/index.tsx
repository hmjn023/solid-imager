import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import { MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	ssr: false,
	pendingComponent: () => null,
	component: Media,
});

function Media() {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });
	const mediaSourceId = () => params().mediaSourceId;
	const mediaId = () => params().mediaId;

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
