import { createFileRoute } from "@tanstack/solid-router";
import { handleRestRequest } from "~/infrastructure/api/rest-handler";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";

export const Route = createFileRoute("/api/rest/$")({
	server: {
		handlers: {
			ANY: ({ request }: ServerRouteContext) => {
				bootstrapServerRoute();
				return handleRestRequest(request);
			},
		},
	},
});
