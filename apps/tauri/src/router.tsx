import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";

export type AppRouterContext = {
	queryClient: QueryClient;
};

let clientQueryClient: QueryClient | undefined;

export function getRouter() {
	if (!clientQueryClient) {
		clientQueryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});
	}

	const queryClient = clientQueryClient;

	return createTanStackRouter({
		routeTree,
		context: {
			queryClient,
		} satisfies AppRouterContext,
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
		router: ReturnType<typeof getRouter>;
	}
}
