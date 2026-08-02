import { createFileRoute } from "@tanstack/solid-router";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";
import { SourceMediaPage } from "~/routes/sources/$mediaSourceId/components/source-media-page";

export const Route = createFileRoute("/v2/sources/$mediaSourceId/")({
	ssr: "data-only",
	remountDeps: ({ params }: { params: { mediaSourceId: string } }) => [
		params.mediaSourceId,
	],
	loader: async ({ context }: RouteLoaderContext) => {
		await Promise.all([
			context.queryClient.prefetchQuery(tagsQueryOptions()),
			context.queryClient.prefetchQuery(allProjectsQueryOptions()),
			context.queryClient.prefetchQuery(allIpsQueryOptions()),
			context.queryClient.prefetchQuery(allCharactersQueryOptions()),
			context.queryClient.prefetchQuery(allAuthorsQueryOptions()),
			context.queryClient.prefetchQuery(mediaSourcesQueryOptions()),
		]);
	},
	component: V2SourceMediaRoute,
});

function V2SourceMediaRoute() {
	const params = Route.useParams();
	return (
		<SourceMediaPage
			mediaSourceId={() => params().mediaSourceId}
			variant="v2"
		/>
	);
}
