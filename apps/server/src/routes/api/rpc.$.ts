import { RPCHandler } from "@orpc/server/fetch";
import { ResponseHeadersPlugin } from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/solid-router";
import { appRouter } from "~/domain/shared/api-contract";
import { createRpcResponseHeaders } from "~/infrastructure/api/rpc-response-headers";
import { logger } from "~/infrastructure/logger";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";

const handler = new RPCHandler(appRouter, {
	plugins: [new ResponseHeadersPlugin()],
});

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: async ({ request }: ServerRouteContext) => {
				bootstrapServerRoute();
				const { response } = await handler.handle(request, {
					prefix: "/api/rpc",
					context: { resHeaders: createRpcResponseHeaders(request.url) },
				});
				if (response) {
					return response;
				}
				logger.warn(
					{ method: request.method, url: request.url },
					"Unmatched RPC request",
				);
				return new Response("Not Found", { status: 404 });
			},
		},
	},
});
