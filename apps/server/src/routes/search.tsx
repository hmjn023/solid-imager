import { searchHistoryQuerySchema } from "@solid-imager/ui/search/history";
import { InitialSearchProvider } from "@solid-imager/ui/search";
import { createFileRoute, useLoaderData } from "@tanstack/solid-router";

import SearchContent from "~/components/pages/search-content";
import { loadInitialSearch } from "~/infrastructure/api-clients/load-initial-search";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/search")({
	validateSearch: searchHistoryQuerySchema,
	loaderDeps: ({ search }: { search: { search?: string } }) => ({
		snapshotId: search.search,
	}),
	loader: ({
		context,
		deps,
	}: RouteLoaderContext & { deps: { snapshotId?: string } }) =>
		loadInitialSearch(context.queryClient, deps.snapshotId),
	component: SearchRoute,
});

function SearchRoute() {
	const initial = useLoaderData({ from: "/search" });
	return (
		<InitialSearchProvider initial={initial()}>
			<SearchContent />
		</InitialSearchProvider>
	);
}
