import { t } from "@solid-imager/i18n";
const ratingLabels: Record<string, string> = {
	g: t("labels.general"),
	s: t("ratings.sensitive"),
	q: t("ratings.questionable"),
	e: t("ratings.explicit"),
};

export function danbooruRatingLabel(rating: string): string {
	return ratingLabels[rating] ?? rating;
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
