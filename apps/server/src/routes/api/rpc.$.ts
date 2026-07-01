import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/solid-router";
import { appRouter } from "~/domain/shared/api-contract";
import { bootstrap } from "~/infrastructure/bootstrap";
import { logger } from "~/infrastructure/logger";

const handler = new RPCHandler(appRouter);

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				bootstrap();
				const { response } = await handler.handle(request, {
					prefix: "/api/rpc",
					context: {},
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
