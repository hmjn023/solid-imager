import type { MediaSearchRequest } from "@solid-imager/core/domain/media/schemas";
import { orpc } from "./orpc-client";

export function searchMedia(
	sourceId: string | undefined | null,
	params: MediaSearchRequest,
) {
	return orpc.media.search({
		sourceId,
		params,
	});
}
