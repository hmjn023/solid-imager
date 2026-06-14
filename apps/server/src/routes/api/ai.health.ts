import { createFileRoute } from "@tanstack/solid-router";
import { initServices } from "~/infrastructure/bootstrap";
import { services } from "~/application/registry";

initServices();

export const Route = createFileRoute("/api/ai/health")({
	server: {
		handlers: {
			GET: async () => {
				const aiClient = services.getAiClient();
				const isHealthy = await aiClient.healthCheck();
				if (isHealthy) {
					return new Response(
						JSON.stringify({
							status: "healthy",
							fallback: aiClient.getBaseUrl?.() === "",
						}),
						{
							status: 200,
							headers: {
								"Content-Type": "application/json",
							},
						},
					);
				}
				return new Response(
					JSON.stringify({
						status: "unhealthy",
					}),
					{
						status: 503,
						headers: {
							"Content-Type": "application/json",
						},
					},
				);
			},
		},
	},
});
