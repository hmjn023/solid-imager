import { createFileRoute } from "@tanstack/solid-router";
import { isServer } from "@solidjs/web";
import { MediaDetailPage } from "~/components/pages/media-detail-page";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

interface MediaRouteParams {
	mediaId: string;
	mediaSourceId: string;
}

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	loader: async ({ context, params }: RouteLoaderContext<MediaRouteParams>) => {
		if (isServer) {
			await context.queryClient
				.query(mediaDetailsQueryOptions(params.mediaSourceId, params.mediaId))
				.catch(() => undefined);
		}
	},
	remountDeps: ({ params }: { params: MediaRouteParams }) => [
		params.mediaSourceId,
		params.mediaId,
	],
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
