import type { DanbooruPost } from "./schemas";

export function getDanbooruMediaType(
	extension: string,
): "image" | "video" | null {
	if (/^(?:jpe?g|png|gif|webp|avif|bmp)$/i.test(extension)) return "image";
	if (/^(?:mp4|webm)$/i.test(extension)) return "video";
	return null;
}

/** Animated ZIP posts may have a playable video sample instead of an image. */
export function getDanbooruPreview(post: DanbooruPost) {
	const originalType = getDanbooruMediaType(post.fileExt);
	if (post.fileUrl && originalType)
		return { url: post.fileUrl, type: originalType };
	if (post.sampleUrl) {
		const extension = new URL(post.sampleUrl).pathname.split(".").at(-1) ?? "";
		const sampleType = getDanbooruMediaType(extension);
		if (sampleType) return { url: post.sampleUrl, type: sampleType };
	}
	return null;
}
