import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { createFileRoute, lazyRouteComponent } from "@tanstack/solid-router";

const V2SearchRoute = lazyRouteComponent(
	() => import("~/routes/v2/components/v2-search-content"),
);

export const Route = createFileRoute("/v2/search")({
	validateSearch: searchHistoryQuerySchema,
	ssr: false,
	pendingComponent: () => null,
	component: V2SearchRoute,
});
