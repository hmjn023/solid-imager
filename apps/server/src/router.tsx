import { isTransientApiError } from "@solid-imager/client";
import { createAppQueryClientConfig } from "@solid-imager/ui/query-options";
import {
	ROUTE_PENDING_DELAY_MS,
	ROUTE_PENDING_MIN_DURATION_MS,
	RouteErrorScreen,
	RoutePendingScreen,
} from "@solid-imager/ui/router-status";
import { NotFoundScreen } from "@solid-imager/ui/screens/not-found-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import type { logger as LoggerInstance } from "./infrastructure/logger";
import { routeTree } from "./routeTree.gen";

function createAppQueryClient(): QueryClient {
	return new QueryClient(createAppQueryClientConfig(isTransientApiError));
}

let serverLogger: typeof LoggerInstance | null = null;

if (isServer) {
	import("./infrastructure/logger")
		.then(({ logger }) => {
			serverLogger = logger;
		})
		.catch(() => {});

	// Initialize services on server startup.
	// We don't use top-level await here to avoid module format issues with CJS dependencies.
	import("./infrastructure/bootstrap")
		.then(({ initServices }) => {
			initServices();
		})
		.catch((err) => {
			if (serverLogger) {
				serverLogger.error({ err }, "[Router] Failed to initialize services");
			} else {
				console.error("[Router] Failed to initialize services:", err);
			}
		});
}

let clientQueryClient: QueryClient | undefined;

export function getRouter() {
	try {
		if (!isServer && !clientQueryClient) {
			clientQueryClient = createAppQueryClient();
		}

		const queryClient =
			isServer || !clientQueryClient
				? createAppQueryClient()
				: clientQueryClient;

		return createTanStackRouter({
			routeTree,
			context: { queryClient },
			scrollRestoration: true,
			defaultPreload: "intent",
			defaultPreloadStaleTime: 0,
			// A route with `ssr: false` renders its pending component on the server,
			// but its route component immediately on the client. Keep the server
			// fallback empty so the hydration trees remain identical.
			defaultPendingComponent: isServer ? undefined : RoutePendingScreen,
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
	} catch (error) {
		if (isServer && serverLogger) {
			serverLogger.error({ err: error }, "[Router] Error creating router");
		} else {
			console.error("[Router] Error creating router:", error);
		}
		throw error;
	}
}

declare module "@tanstack/solid-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
