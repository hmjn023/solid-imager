import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { routeTree } from "./routeTree.gen";

if (import.meta.env.SSR) {
	console.log("[Router] Server-side initialization starting...");
	// Initialize services on server startup.
	// We don't use top-level await here to avoid module format issues with CJS dependencies.
	import("./infrastructure/bootstrap")
		.then(({ initServices }) => {
			console.log("[Router] Calling initServices()...");
			initServices();
		})
		.catch((err) => {
			console.error("[Router] Failed to initialize services:", err);
		});
}

let clientQueryClient: QueryClient | undefined;

export function getRouter() {
	try {
		if (!isServer && !clientQueryClient) {
			clientQueryClient = new QueryClient({
				defaultOptions: {
					queries: {
						retry: false,
					},
				},
			});
		}

		const queryClient =
			isServer || !clientQueryClient
				? new QueryClient({
						defaultOptions: {
							queries: {
								retry: false,
							},
						},
					})
				: clientQueryClient;

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
