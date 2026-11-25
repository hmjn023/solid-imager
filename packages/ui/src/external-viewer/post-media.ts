import { t, type StaticMessageKey } from "@solid-imager/i18n";
import {
	API_PREFIX,
	DANBOORU_THUMBNAIL_ROUTE,
	PIXIV_IMAGE_ROUTE,
	resolveServerUrl,
} from "@solid-imager/core/http";
import type { StaticThumbnailSource } from "../thumbnail-image";

const ratingLabels = new Map<string, StaticMessageKey>([
	["g", "labels.general"],
	["s", "ratings.sensitive"],
	["q", "ratings.questionable"],
	["e", "ratings.explicit"],
]);

export function danbooruRatingLabel(rating: string): string {
	const label = ratingLabels.get(rating);
	return label ? t(label) : rating;
}

export function pixivImageHref(base: string, url: string): string {
	return viewerImageHref(base, PIXIV_IMAGE_ROUTE, url);
}

export function danbooruThumbnailHref(base: string, url: string): string {
	return viewerImageHref(base, DANBOORU_THUMBNAIL_ROUTE, url);
}

export function pixivThumbnailSource(
	base: string,
	thumbnail: string | null,
): StaticThumbnailSource | null {
	if (!thumbnail) return null;
	const large = pixivImageHref(base, thumbnail);
	const cdn = new URL(thumbnail);
	const largePrefix = "/c/480x960/";
	if (
		cdn.origin !== "https://i.pximg.net" ||
		!cdn.pathname.startsWith(largePrefix)
	)
		return { url: large };
	cdn.pathname = "/c/240x480/" + cdn.pathname.slice(largePrefix.length);
	const small = pixivImageHref(base, cdn.href);
	return {
		url: small,
		srcSet: `${small} 1x, ${large} 2x`,
		fallbackUrl: large,
	};
}

function viewerImageHref(
	base: string,
	path: typeof PIXIV_IMAGE_ROUTE | typeof DANBOORU_THUMBNAIL_ROUTE,
	url: string,
) {
	const proxy = new URL(resolveServerUrl(base, API_PREFIX + path));
	proxy.searchParams.set("url", url);
	return proxy.href;
}
