import { pixivImageUrlSchema } from "@solid-imager/core/external-viewer";
import { serveViewerImage } from "./viewer-image";
export function servePixivImage(
	request: Request,
	fetchImage: typeof fetch = fetch,
) {
	return serveViewerImage(
		request,
		pixivImageUrlSchema,
		{ Referer: "https://www.pixiv.net/" },
		fetchImage,
	);
}
