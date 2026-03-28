import { createRouter as createTanStackRouter } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { routeTree } from "./routeTree.gen";

if (isServer) {
	import("./infrastructure/bootstrap").then(({ bootstrap }) => bootstrap());
}

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});
}

declare module "@tanstack/solid-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
