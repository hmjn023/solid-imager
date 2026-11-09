import { createFileRoute } from "@tanstack/solid-router";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { servePixivAnimation } from "~/infrastructure/services/pixiv-animation";
export const Route = createFileRoute("/api/pixiv-animation/$id")({
	server: {
		handlers: {
			GET: ({ params }: ServerRouteContext<{ id: string }>) =>
				servePixivAnimation(Number(params.id)),
		},
	},
});
