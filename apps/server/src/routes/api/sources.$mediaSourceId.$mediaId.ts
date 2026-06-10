import { createFileRoute } from "@tanstack/solid-router";
import { MediaService } from "~/application/services/media-service";
import { bootstrap } from "~/infrastructure/bootstrap";
import { bufferToBodyInit } from "~/infrastructure/utils/stream-utils";

export const Route = createFileRoute("/api/sources/$mediaSourceId/$mediaId")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				bootstrap();
				const { mediaSourceId, mediaId } = params;
				const { buffer, contentType } = await MediaService.getMediaContent(
					mediaSourceId,
					mediaId,
				);
				return new Response(bufferToBodyInit(buffer), {
					headers: { "Content-Type": contentType },
				});
			},
		},
	},
});
