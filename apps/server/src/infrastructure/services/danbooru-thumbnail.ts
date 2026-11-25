import { danbooruThumbnailUrlSchema } from "@solid-imager/core/danbooru";
import { serveViewerImage } from "./viewer-image";

export function serveDanbooruThumbnail(
	url: string,
	signal?: AbortSignal,
	fetchImage: typeof fetch = fetch,
) {
	return serveViewerImage(
		url,
		signal,
		danbooruThumbnailUrlSchema,
		{
			Referer: "https://danbooru.donmai.us/",
			"User-Agent": "SolidImager/1.0 (Danbooru viewer)",
		},
		fetchImage,
	);
}
