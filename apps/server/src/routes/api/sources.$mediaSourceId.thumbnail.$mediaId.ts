import { thumbnailSizeSchema } from "@solid-imager/core/domain/thumbnails/schemas";
import { createFileRoute } from "@tanstack/solid-router";
import {
	getThumbnailPath,
	queueThumbnailGeneration,
	THUMBNAIL_SIZE_LARGE,
	THUMBNAIL_SIZE_SMALL,
} from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";

export const Route = createFileRoute(
	"/api/sources/$mediaSourceId/thumbnail/$mediaId",
)({
	server: {
		handlers: {
			GET: async ({
				params,
				request,
			}: ServerRouteContext<{ mediaId: string; mediaSourceId: string }>) => {
				bootstrapServerRoute();
				const { mediaSourceId, mediaId } = params;
				const searchParams = new URL(request.url).searchParams;
				const rawSize = searchParams.get("size");
				const parsedSize = thumbnailSizeSchema.safeParse(
					rawSize === null ? THUMBNAIL_SIZE_LARGE : Number(rawSize),
				);
				if (!parsedSize.success) {
					return new Response("size must be 256 or 512", { status: 400 });
				}
				const size = parsedSize.data;
				const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId, size);
				const file = Bun.file(thumbnailPath);

				if (!(await file.exists())) {
					void queueThumbnailGeneration(mediaSourceId, mediaId, size).catch(
						(error) =>
							logger.error(
								{ err: error, mediaId, mediaSourceId, size },
								"Failed to queue on-demand thumbnail generation",
							),
					);
					if (size === THUMBNAIL_SIZE_SMALL) {
						const fallback = Bun.file(
							getThumbnailPath(mediaSourceId, mediaId, THUMBNAIL_SIZE_LARGE),
						);
						if (await fallback.exists()) {
							return new Response(fallback, {
								headers: {
									"Cache-Control": "private, max-age=30",
									"Content-Type": "image/webp",
									"X-Thumbnail-Fallback": "512",
								},
							});
						}
					}
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
					headers: {
						"Cache-Control": searchParams.has("t")
							? "private, max-age=31536000, immutable"
							: "private, max-age=300",
						"Content-Type": "image/webp",
					},
				});
			},
		},
	},
});
