const ratingLabels: Record<string, string> = {
	g: "General",
	s: "Sensitive",
	q: "Questionable",
	e: "Explicit",
};

export function danbooruRatingLabel(rating: string): string {
	return ratingLabels[rating] ?? rating;
}

export function pixivImageHref(base: string, url: string): string {
	const proxy = new URL("/api/pixiv-image", base);
	proxy.searchParams.set("url", url);
	return proxy.href;
}
