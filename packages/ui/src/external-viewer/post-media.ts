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
	const proxy = new URL("/api/pixiv-image", base);
	proxy.searchParams.set("url", url);
	return proxy.href;
}
