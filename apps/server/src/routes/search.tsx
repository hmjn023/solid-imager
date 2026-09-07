import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { createFileRoute, lazyRouteComponent } from "@tanstack/solid-router";

const SearchRoute = lazyRouteComponent(
	() => import("~/routes/v2/components/search-content"),
);

export const Route = createFileRoute("/search")({
	validateSearch: searchHistoryQuerySchema,
	ssr: false,
	pendingComponent: () => null,
	component: SearchRoute,
});
