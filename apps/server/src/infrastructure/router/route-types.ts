import type { QueryClient } from "@tanstack/solid-query";

/** Context passed to route loaders by the application's root route. */
export interface RouteLoaderContext<TParams = Record<string, never>> {
	context: {
		queryClient: QueryClient;
	};
	params: TParams;
	/** True when the router is warming the route before navigation. */
	preload?: boolean;
}

/** Web-standard request context passed to API route handlers. */
export interface ServerRouteContext<TParams = Record<string, never>> {
	params: TParams;
	request: Request;
}
