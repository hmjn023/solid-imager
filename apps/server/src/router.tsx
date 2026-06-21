import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { isTransientApiError } from "./infrastructure/api-clients/error-policy";
import { routeTree } from "./routeTree.gen";

const QUERY_RETRY_DELAY_CAP_MS = 5_000;
const QUERY_RETRY_DELAY_BASE_MS = 1_000;
const QUERY_STALE_TIME_MS = 5_000;

function createAppQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				refetchOnWindowFocus: false,
				retry: (failureCount, error) =>
					isTransientApiError(error) && failureCount < 2,
				retryDelay: (attemptIndex) =>
					Math.min(
						QUERY_RETRY_DELAY_BASE_MS * 2 ** attemptIndex,
						QUERY_RETRY_DELAY_CAP_MS,
					),
				staleTime: QUERY_STALE_TIME_MS,
			},
			mutations: {
				retry: false,
			},
		},
	});
}

if (isServer) {
	// Initialize services on server startup.
	// We don't use top-level await here to avoid module format issues with CJS dependencies.
	import("./infrastructure/bootstrap")
		.then(({ initServices }) => {
			initServices();
		})
		.catch((err) => {
			import("./infrastructure/logger")
				.then(({ logger }) => {
					logger.error({ err }, "[Router] Failed to initialize services");
				})
				.catch(() => {
					console.error("[Router] Failed to initialize services:", err);
				});
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
			Wrap: (props) => (
				<QueryClientProvider client={queryClient}>
					{props.children}
				</QueryClientProvider>
			),
		});
	} catch (error) {
		if (isServer) {
			import("./infrastructure/logger")
				.then(({ logger }) => {
					logger.error({ err: error }, "[Router] Error creating router");
				})
				.catch(() => {
					console.error("[Router] Error creating router:", error);
				});
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
