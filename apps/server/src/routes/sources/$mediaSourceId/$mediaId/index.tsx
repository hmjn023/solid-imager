import { createFileRoute } from "@tanstack/solid-router";
import { V2MediaDetailPage } from "~/components/v2/v2-media-detail-page";

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
		<V2MediaDetailPage
			mediaId={() => params().mediaId}
			mediaSourceId={() => params().mediaSourceId}
		/>
	);
}
