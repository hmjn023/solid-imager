import type { MediaRegionService } from "@solid-imager/application/services/media-region-service";
import {
	ResourceConflictError,
	ResourceNotFoundError,
	ValidationError,
} from "@solid-imager/core/domain/errors";
import { mediaRevisionSchema } from "@solid-imager/core/domain/media-regions/schemas";

export type MediaRegionRenderService = Pick<
	MediaRegionService,
	"getRenderIdentity" | "render"
>;

export async function handleMediaRegionRenderRequest(
	request: Request,
	regionId: string,
	service: MediaRegionRenderService,
): Promise<Response> {
	const search = new URL(request.url).searchParams;
	const parsedRevision = mediaRevisionSchema.safeParse(search.get("revision"));
	if (!parsedRevision.success) {
		return new Response("Invalid or missing region revision", { status: 400 });
	}
	const expectedRevision = parsedRevision.data;
	const transparent = search.get("transparent") === "true";
	try {
		const { etag } = await service.getRenderIdentity(
			regionId,
			expectedRevision,
			{ transparent },
		);
		if (request.headers.get("If-None-Match") === etag) {
			return new Response(null, {
				status: 304,
				headers: {
					"Cache-Control": "private, no-cache",
					ETag: etag,
				},
			});
		}
		const rendered = await service.render(regionId, expectedRevision, {
			transparent,
		});
		return new Response(Uint8Array.from(rendered.bytes).buffer, {
			headers: {
				"Cache-Control": "private, no-cache",
				"Content-Type": `image/${rendered.format}`,
				ETag: etag,
			},
		});
	} catch (error) {
		if (error instanceof ResourceNotFoundError) {
			return new Response(error.message, { status: 404 });
		}
		if (error instanceof ResourceConflictError) {
			return new Response(error.message, { status: 409 });
		}
		if (error instanceof ValidationError) {
			return new Response(error.message, { status: 400 });
		}
		throw error;
	}
}
