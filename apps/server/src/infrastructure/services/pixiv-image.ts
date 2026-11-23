import { pixivImageUrlSchema } from "@solid-imager/core/external-viewer";
import { serveViewerImage } from "./viewer-image";
export function servePixivImage(
	url: string,
	signal?: AbortSignal,
	fetchImage: typeof fetch = fetch,
) {
	return serveViewerImage(
		url,
		signal,
		pixivImageUrlSchema,
		{ Referer: "https://www.pixiv.net/" },
		fetchImage,
	);
}
