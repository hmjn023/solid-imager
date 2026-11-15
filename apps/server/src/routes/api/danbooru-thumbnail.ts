import { createFileRoute } from "@tanstack/solid-router";
import { serveDanbooruThumbnail } from "~/infrastructure/services/danbooru-thumbnail";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";

export const Route = createFileRoute("/api/danbooru-thumbnail")({
	server: {
		handlers: {
			GET: ({ request }: ServerRouteContext) => serveDanbooruThumbnail(request),
		},
	},
});
