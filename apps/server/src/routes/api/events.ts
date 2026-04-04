import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/api/events")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const [{ bootstrap }, { SseManager }] = await Promise.all([
					import("~/infrastructure/bootstrap"),
					import("~/infrastructure/jobs/sse-manager"),
				]);
				bootstrap();
				const url = new URL(request.url);
				const channels = url.searchParams.get("channels")?.split(",") ?? [
					"global-jobs",
				];

				const stream = new ReadableStream({
					start(controller) {
						const clientIds = channels.map((channel) =>
							SseManager.addClient(channel, controller),
						);

						request.signal.addEventListener("abort", () => {
							clientIds.forEach((clientId, i) => {
								SseManager.removeClient(channels[i], clientId);
							});
						});
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					},
				});
			},
		},
	},
});
