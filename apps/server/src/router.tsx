import { isTransientApiError } from "@solid-imager/client";
import { createAppQueryClientConfig } from "@solid-imager/ui/query-options";
import {
	ROUTE_PENDING_DELAY_MS,
	ROUTE_PENDING_MIN_DURATION_MS,
	RouteErrorScreen,
	RoutePendingScreen,
} from "@solid-imager/ui/router-status";
import { NotFoundScreen } from "@solid-imager/ui/screens/not-found-screen";
import { QueryClient } from "@tanstack/solid-query";
import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/solid-router-ssr-query";
import { isServer } from "solid-js/web";
import { routeTree } from "#route-tree";
import type { logger as LoggerInstance } from "./infrastructure/logger";

function createAppQueryClient(): QueryClient {
	return new QueryClient(createAppQueryClientConfig(isTransientApiError));
}

let serverLogger: typeof LoggerInstance | null = null;
let serverInitializationPromise: Promise<void> | undefined;

async function initializeServerDependencies(): Promise<void> {
	if (!isServer) {
		return;
	}

	if (!serverInitializationPromise) {
		serverInitializationPromise = Promise.all([
			import("./infrastructure/logger"),
			import("./infrastructure/bootstrap"),
		]).then(([{ logger }, { initServices }]) => {
			serverLogger = logger;
			initServices();
		});
	}

	await serverInitializationPromise;
}

let clientQueryClient: QueryClient | undefined;

export async function getRouter() {
	try {
		await initializeServerDependencies();

		if (!isServer && !clientQueryClient) {
			clientQueryClient = createAppQueryClient();
		}

		const queryClient =
			isServer || !clientQueryClient
				? createAppQueryClient()
				: clientQueryClient;

		const router = createTanStackRouter({
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
		});
		setupRouterSsrQueryIntegration({ router, queryClient });
		return router;
	} catch (error) {
		if (isServer && serverLogger) {
			serverLogger.error({ err: error }, "[Router] Error creating router");
		} else if (!isServer) {
			console.error("[Router] Error creating router:", error);
		}
		throw error;
	}
}

declare module "@tanstack/solid-router" {
	interface Register {
		router: Awaited<ReturnType<typeof getRouter>>;
	}
}
