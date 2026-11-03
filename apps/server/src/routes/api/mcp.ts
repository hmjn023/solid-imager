import { createFileRoute } from "@tanstack/solid-router";
import { handleMcpRequest } from "~/infrastructure/mcp/http-handler";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";

export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			ANY: ({ request }: ServerRouteContext) =>
				handleMcpRequest(request, bootstrapServerRoute),
		},
	},
});
