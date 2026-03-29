import { RPCHandler } from "@orpc/server/fetch";
import { createFileRoute } from "@tanstack/solid-router";
import { appRouter } from "~/domain/shared/api-contract";
import { bootstrap } from "~/infrastructure/bootstrap";

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
				return response ?? new Response("Not Found", { status: 404 });
			},
		},
	},
});
