import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute(
	"/api/sources/$mediaSourceId/$mediaId/thumbnail",
)({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const [fs, { bootstrap }, { getThumbnailPath }] = await Promise.all([
					import("node:fs/promises"),
					import("~/infrastructure/bootstrap"),
					import("~/infrastructure/jobs/thumbnails"),
				]);
				bootstrap();
				const { mediaSourceId, mediaId } = params;
				const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);
				try {
					const thumbnailBuffer = await fs.readFile(thumbnailPath);
					return new Response(thumbnailBuffer, {
						headers: { "Content-Type": "image/webp" },
					});
				} catch {
					return new Response("Thumbnail not found", { status: 404 });
				}
			},
		},
	},
});
