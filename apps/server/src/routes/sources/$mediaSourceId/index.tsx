import { searchHistoryQuerySchema } from "@solid-imager/ui/search/history";
import { InitialSearchProvider } from "@solid-imager/ui/search";
import { createFileRoute } from "@tanstack/solid-router";
import { loadInitialSearch } from "~/infrastructure/api-clients/load-initial-search";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";
import { SourceMediaPage } from "./components/source-media-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	validateSearch: searchHistoryQuerySchema,
	loaderDeps: ({ search }: { search: { search?: string } }) => ({
		snapshotId: search.search,
	}),
	loader: ({
		context,
		params,
		deps,
	}: RouteLoaderContext<{ mediaSourceId: string }> & {
		deps: { snapshotId?: string };
	}) =>
		loadInitialSearch(
			context.queryClient,
			deps.snapshotId,
			params.mediaSourceId,
		),
	remountDeps: ({ params }: { params: { mediaSourceId: string } }) => [
		params.mediaSourceId,
	],
	component: SourceMediaRoute,
});

function SourceMediaRoute() {
	const params = Route.useParams();
	const initial = Route.useLoaderData();
	return (
		<InitialSearchProvider initial={initial()}>
			<SourceMediaPage mediaSourceId={() => params().mediaSourceId} />
		</InitialSearchProvider>
	);
}
