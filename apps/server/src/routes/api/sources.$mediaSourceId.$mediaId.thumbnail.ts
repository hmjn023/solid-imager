import fs from "node:fs/promises";
import { createFileRoute } from "@tanstack/solid-router";
import { bootstrap } from "~/infrastructure/bootstrap";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";

export const Route = createFileRoute("/api/sources/$mediaSourceId/$mediaId/thumbnail")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				bootstrap();
				const { mediaSourceId, mediaId } = params;
				const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);
				try {
					const thumbnailBuffer = await fs.readFile(thumbnailPath);
					return new Response(thumbnailBuffer, {
						headers: {
							"Cache-Control": "private, max-age=60",
							"Content-Type": "image/webp",
						},
					});
				} catch {
					return new Response("Thumbnail not found", {
						headers: { "Cache-Control": "no-store" },
						status: 404,
					});
				}
			},
		},
	},
});
