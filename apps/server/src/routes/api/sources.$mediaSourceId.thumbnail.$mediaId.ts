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
					// A missing thumbnail is an expected transient state while the
					// background job is running. The image component treats an empty
					// response as a load error and retries, without flooding the
					// browser console with expected 404 responses.
					return new Response(null, {
						status: 204,
						headers: { "Cache-Control": "no-store" },
					});
				}

				return new Response(file, {
					headers: { "Content-Type": "image/webp" },
				});
			},
		},
	},
});
