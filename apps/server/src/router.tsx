import { isTransientApiError } from "@solid-imager/client";
import { createAppQueryClientConfig } from "@solid-imager/ui/query";
import { RouteErrorScreen } from "@solid-imager/ui/router-status";
import { NotFoundScreen } from "@solid-imager/ui/screens/not-found";
import { QueryClient } from "@tanstack/solid-query";
import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/solid-router-ssr-query";
import { isServer } from "solid-js/web";
import { routeTree } from "#route-tree";
import type { logger as LoggerInstance } from "./infrastructure/logger";

function createAppQueryClient(): QueryClient {
	const config = createAppQueryClientConfig(isTransientApiError);
	if (isServer) {
		// The request owns this cache. Avoid retaining it in garbage collection timers.
		config.defaultOptions = {
			...config.defaultOptions,
			queries: {
				...config.defaultOptions?.queries,
				gcTime: Infinity,
				retry: false,
			},
		};
	}
	return new QueryClient(config);
}

let serverLogger: typeof LoggerInstance | null = null;

if (isServer) {
	// TanStack Start expects getRouter to synchronously return a router. Keep
	// initialization asynchronous so server-only dependencies remain outside the
	// client module graph; route handlers still initialize their own services.
	void Promise.all([
		import("./infrastructure/logger"),
		import("./infrastructure/bootstrap"),
	])
		.then(([{ logger }, { initServices }]) => {
			serverLogger = logger;
			initServices();
		})
		.catch((error: unknown) => {
			if (serverLogger) {
				serverLogger.error(
					{ err: error },
					"[Router] Failed to initialize services",
				);
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

		// Keep the current screen visible during navigation. The app shell
		// indicates route loading and each screen owns its data placeholders.
		const router = createTanStackRouter({
			routeTree,
			context: { queryClient },
			scrollRestoration: true,
			// Loader-heavy routes opt into intent preloading individually. Keeping the
			// global default disabled avoids stale matches from aborted preloads.
			defaultPreload: false,
			defaultPreloadStaleTime: 0,
			defaultErrorComponent: RouteErrorScreen,
			defaultNotFoundComponent: NotFoundScreen,
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
		router: ReturnType<typeof getRouter>;
	}
}
