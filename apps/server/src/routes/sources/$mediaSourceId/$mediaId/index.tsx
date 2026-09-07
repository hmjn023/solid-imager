import { createFileRoute } from "@tanstack/solid-router";
import { V2MediaDetailContent } from "../../../v2/sources/$mediaSourceId/$mediaId";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	ssr: false,
	remountDeps: ({
		params,
	}: {
		params: { mediaSourceId: string; mediaId: string };
	}) => [params.mediaSourceId, params.mediaId],
	pendingComponent: () => null,
	component: MediaDetailRoute,
});

function MediaDetailRoute() {
	const params = Route.useParams();
	return (
		<V2MediaDetailContent
			mediaId={() => params().mediaId}
			mediaSourceId={() => params().mediaSourceId}
		/>
	);
}
