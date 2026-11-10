import { createFileRoute } from "@tanstack/solid-router";
import { servePixivImage } from "~/infrastructure/services/pixiv-image";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
export const Route = createFileRoute("/api/pixiv-image")({
	server: {
		handlers: {
			GET: ({ request }: ServerRouteContext) => servePixivImage(request),
		},
	},
});
