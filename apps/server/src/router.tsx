import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { isServer } from "solid-js/web";
import { routeTree } from "./routeTree.gen";

if (isServer) {
	console.log("[Router] Server-side initialization starting...");
	// Initialize services on server startup.
	// We don't use top-level await here to avoid module format issues with CJS dependencies.
	import("./infrastructure/bootstrap").then(({ initServices }) => {
		console.log("[Router] Calling initServices()...");
		initServices();
	}).catch(err => {
		console.error("[Router] Failed to initialize services:", err);
	});
}

let clientQueryClient: QueryClient | undefined;

export function getRouter() {
	try {
		const queryClient = isServer
			? new QueryClient({
					defaultOptions: {
						queries: {
							retry: false,
						},
					},
				})
			: (clientQueryClient ??= new QueryClient({
					defaultOptions: {
						queries: {
							retry: false,
						},
					},
				}));

		return createTanStackRouter({
			routeTree,
			context: { queryClient },
			scrollRestoration: true,
			defaultPreload: "intent",
			defaultPreloadStaleTime: 0,
			Wrap: (props) => (
				<QueryClientProvider client={queryClient}>
					{props.children}
				</QueryClientProvider>
			),
		});
	} catch (error) {
		console.error("[Router] Error creating router:", error);
		throw error;
	}
}

declare module "@tanstack/solid-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
