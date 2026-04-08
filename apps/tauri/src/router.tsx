import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter } from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
});

export const router = createRouter({
	routeTree,
	context: {
		queryClient,
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

declare module "@tanstack/solid-router" {
	interface Register {
		router: typeof router;
	}
}
