import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createHashHistory, createRouter } from "@tanstack/solid-router";
import type { TauriAppServices } from "./bootstrap";
import { routeTree } from "./routeTree.gen";

export type AppRouterContext = {
	queryClient: QueryClient;
	services: TauriAppServices;
};

export function createAppRouter(services: TauriAppServices) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return createRouter({
		routeTree,
		history: createHashHistory(),
		context: {
			queryClient,
			services,
		},
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
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
