import { QueryClient } from "@tanstack/solid-query";
import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { routeTree } from "./routeTree.gen";

if (isServer) {
	import("./infrastructure/bootstrap").then(({ bootstrap }) => bootstrap());
}

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const FIVE_MINUTES = 5;
const FIVE_MINUTES_IN_MS = FIVE_MINUTES * MINUTES_TO_MS;

function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: 1,
				staleTime: FIVE_MINUTES_IN_MS,
				refetchOnWindowFocus: false,
			},
		},
	});
	return {
		queryClient,
	};
}

export function getRouter() {
	const context = getContext();
	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	return router;
}

declare module "@tanstack/solid-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
