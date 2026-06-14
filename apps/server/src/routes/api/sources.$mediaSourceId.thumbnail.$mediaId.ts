import { createFileRoute } from "@tanstack/solid-router";
import { bootstrap } from "~/infrastructure/bootstrap";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";

export const Route = createFileRoute(
	"/api/sources/$mediaSourceId/thumbnail/$mediaId",
)({
	server: {
		handlers: {
			GET: async ({ params }) => {
				bootstrap();
				const { mediaSourceId, mediaId } = params;
				const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);
				const file = Bun.file(thumbnailPath);

				if (!(await file.exists())) {
					return new Response("Thumbnail not found", { status: 404 });
				}

				return new Response(file, {
					headers: { "Content-Type": "image/webp" },
				});
			},
		},
	},
});
