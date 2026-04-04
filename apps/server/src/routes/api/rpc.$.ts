import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				const [{ RPCHandler }, { appRouter }, { bootstrap }] =
					await Promise.all([
						import("@orpc/server/fetch"),
						import("~/domain/shared/api-contract"),
						import("~/infrastructure/bootstrap"),
					]);
				bootstrap();
				const handler = new RPCHandler(appRouter);
				const { response } = await handler.handle(request, {
					prefix: "/api/rpc",
					context: {},
				});
				return response ?? new Response("Not Found", { status: 404 });
			},
		},
	},
});
