import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { createFileRoute, lazyRouteComponent } from "@tanstack/solid-router";

const SearchRoute = lazyRouteComponent(
	() => import("~/components/pages/search-content"),
);

export const Route = createFileRoute("/search")({
	validateSearch: searchHistoryQuerySchema,
	ssr: false,
	pendingComponent: () => null,
	component: SearchRoute,
});
