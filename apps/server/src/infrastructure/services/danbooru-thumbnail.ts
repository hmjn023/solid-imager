import { danbooruMediaUrlSchema } from "@solid-imager/core/danbooru";
import { serveViewerImage } from "./viewer-image";

const thumbnailUrlSchema = danbooruMediaUrlSchema.refine((value) => {
	const url = URL.parse(value);
	return (
		url?.hostname === "cdn.donmai.us" &&
		/^\/(?:[0-9]+x[0-9]+|preview)\/[a-f0-9/]+\.(?:jpg|png|webp)$/i.test(
			url.pathname,
		)
	);
});

export function serveDanbooruThumbnail(
	request: Request,
	fetchImage: typeof fetch = fetch,
) {
	return serveViewerImage(
		request,
		thumbnailUrlSchema,
		{
			Referer: "https://danbooru.donmai.us/",
			"User-Agent": "SolidImager/1.0 (Danbooru viewer)",
		},
		fetchImage,
	);
}
