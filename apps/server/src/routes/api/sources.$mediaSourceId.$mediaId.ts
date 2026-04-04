import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/api/sources/$mediaSourceId/$mediaId")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const [{ MediaService }, { bootstrap }] = await Promise.all([
					import("~/application/services/media-service"),
					import("~/infrastructure/bootstrap"),
				]);
				bootstrap();
				const { mediaSourceId, mediaId } = params;
				const { buffer, contentType } = await MediaService.getMediaContent(
					mediaSourceId,
					mediaId,
				);
				return new Response(buffer as unknown as BodyInit, {
					headers: { "Content-Type": contentType },
				});
			},
		},
	},
});
