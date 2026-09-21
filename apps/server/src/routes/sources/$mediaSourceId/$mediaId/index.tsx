import { createFileRoute } from "@tanstack/solid-router";
import { MediaDetailPage } from "~/components/pages/media-detail-page";

interface MediaRouteParams {
	mediaId: string;
	mediaSourceId: string;
}

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	ssr: false,
	remountDeps: ({ params }: { params: MediaRouteParams }) => [
		params.mediaSourceId,
		params.mediaId,
	],
	pendingComponent: () => null,
	component: MediaRoute,
});

function MediaRoute() {
	const params = Route.useParams();
	return (
		<MediaDetailPage
			mediaId={() => params().mediaId}
			mediaSourceId={() => params().mediaSourceId}
		/>
	);
}
