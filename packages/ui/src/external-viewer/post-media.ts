import { t, type StaticMessageKey } from "@solid-imager/i18n";

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
	return viewerImageHref(base, "/api/pixiv-image", url);
}

export function viewerImageHref(
	base: string,
	path: "/api/pixiv-image" | "/api/danbooru-thumbnail",
	url: string,
) {
	const proxy = new URL(path, base);
	proxy.searchParams.set("url", url);
	return proxy.href;
}
