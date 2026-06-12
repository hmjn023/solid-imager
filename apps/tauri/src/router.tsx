import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createHashHistory, createRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";

export type AppRouterContext = {
	queryClient: QueryClient;
};

const queryClient = new QueryClient({
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
