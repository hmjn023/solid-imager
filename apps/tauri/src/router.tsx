import {
	ROUTE_PENDING_DELAY_MS,
	ROUTE_PENDING_MIN_DURATION_MS,
	RouteErrorScreen,
	RoutePendingScreen,
} from "@solid-imager/ui/router-status";
import { NotFoundScreen } from "@solid-imager/ui/screens/not-found-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createHashHistory, createRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";

export type AppRouterContext = {
	queryClient: QueryClient;
};

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
});

export function createAppRouter() {
	return createRouter({
		routeTree,
		history: createHashHistory(),
		context: {
			queryClient,
		} satisfies AppRouterContext,
		scrollRestoration: true,
		defaultPreload: "intent",
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
