import { createFileRoute } from "@tanstack/solid-router";

const healthResponse = JSON.stringify({
	service: "solid-imager",
	status: "ok",
});

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () =>
				new Response(healthResponse, {
					headers: {
						"Cache-Control": "no-store",
						"Content-Type": "application/json; charset=utf-8",
					},
					status: 200,
				}),
		},
	},
});
