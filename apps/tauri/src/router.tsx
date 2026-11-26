import {
	ROUTE_PENDING_DELAY_MS,
	ROUTE_PENDING_MIN_DURATION_MS,
	RouteErrorScreen,
	RoutePendingScreen,
} from "@solid-imager/ui/router-status";
import { NotFoundScreen } from "@solid-imager/ui/screens/not-found";
import { QueryClientProvider } from "@tanstack/solid-query";
import { createHashHistory, createRouter } from "@tanstack/solid-router";
import { queryClient } from "./query-client";
import { routeTree } from "./routeTree.gen";

export { queryClient } from "./query-client";

export function createAppRouter() {
	return createRouter({
		routeTree,
		history: createHashHistory(),
		context: { queryClient },
		scrollRestoration: true,
		// Loader-heavy routes opt into intent preloading individually. Keeping the
		// global default disabled avoids stale matches from aborted preloads and
		// matches the web router.
		defaultPreload: false,
		defaultPreloadStaleTime: 0,
		defaultPendingComponent: RoutePendingScreen,
		defaultErrorComponent: RouteErrorScreen,
		defaultNotFoundComponent: NotFoundScreen,
		defaultPendingMs: ROUTE_PENDING_DELAY_MS,
		defaultPendingMinMs: ROUTE_PENDING_MIN_DURATION_MS,
		Wrap: (props) => (
			<QueryClientProvider client={queryClient}>
				{props.children}
			</QueryClientProvider>
		),
	});
}

declare module "@tanstack/solid-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
