import { z } from "zod";
import { tagMappingSchema } from "./search";
import type { DownloadItem } from "../media/schemas";
import { ugoiraMetadataSchema } from "../media/ugoira-schemas";

/** Constrain the CDN relay to pixiv artwork images (including thumbnails). */
export const pixivImageUrlSchema = z.url().refine((value) => {
	const url = URL.parse(value);
	return (
		!!url &&
		url.origin === "https://i.pximg.net" &&
		!url.username &&
		!url.password &&
		/^\/(?:c\/[^/]+\/)?(?:img-master|img-original|custom-thumb|img-zip-ugoira)\/img\/[\w./-]+\.(?:jpe?g|png|gif|webp)$/i.test(
			url.pathname,
		)
	);
});
export const pixivCardSchema = z.object({
	id: z.number().int().positive(),
	title: z.string(),
	author: z.string(),
	thumbnail: pixivImageUrlSchema.nullable(),
	pageCount: z.number().int().positive(),
});
export type PixivCard = z.infer<typeof pixivCardSchema>;
export const pixivArtworkSchema = pixivCardSchema.extend({
	userId: z.string().regex(/^\d+$/),
	tags: z.array(z.string()),
	createdAt: z.iso.datetime({ offset: true }),
	pages: z
		.array(
			z.object({
				preview: pixivImageUrlSchema,
				original: pixivImageUrlSchema.nullable(),
				width: z.number().int().positive(),
				height: z.number().int().positive(),
			}),
		)
		.min(1),
	isAnimation: z.boolean(),
	animation: z
		.object({ zip: z.url(), metadata: ugoiraMetadataSchema })
		.optional(),
});
export type PixivArtwork = z.infer<typeof pixivArtworkSchema>;
export const pixivSearchResultSchema = z.object({
	provider: z.literal("pixiv"),
	posts: z.array(pixivCardSchema),
	hasNextPage: z.boolean(),
	word: z.string(),
	mappings: z.array(tagMappingSchema),
});
export type PixivSearchResult = z.infer<typeof pixivSearchResultSchema>;
export function pixivDownloadItem(
	post: PixivArtwork,
	page: number,
): DownloadItem | null {
	const url = post.animation?.zip ?? post.pages[page]?.original;
	if (!url) return null;
	return {
		targetUrl: url,
		sourceUrls: [url, "https://www.pixiv.net/artworks/" + post.id],
		description: post.title,
		createdAt: new Date(post.createdAt),
		authors: [
			{
				name: post.author,
				accountId: post.userId,
				remoteId: post.userId,
				platform: "pixiv",
				profileUrl: "https://www.pixiv.net/users/" + post.userId,
			},
		],
		tags: post.tags.map((name) => ({
			name,
			type: "positive",
			source: "pixiv",
		})),
		...(post.animation ? { ugoira: post.animation.metadata } : {}),
	};
}
