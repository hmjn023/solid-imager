import { createFileRoute } from "@tanstack/solid-router";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/docs/swagger/")({
	server: {
		handlers: {
			GET: ({ request }: ServerRouteContext) => {
				const url = new URL(request.url);
				const scalar = url.pathname.endsWith("/") ? "../scalar" : "scalar";
				return new Response(null, {
					status: 302,
					headers: { Location: scalar + url.search },
				});
			},
		},
	},
});
