import { z } from "zod";

/** Only Danbooru's HTTPS media hosts may be used by the remote viewer. */
export const danbooruMediaUrlSchema = z.url().refine((value) => {
	const url = new URL(value);
	return (
		url.protocol === "https:" &&
		!url.username &&
		!url.password &&
		!url.port &&
		(url.hostname === "donmai.us" || url.hostname.endsWith(".donmai.us"))
	);
});

export const danbooruPostSchema = z.object({
	id: z.number().int().positive(),
	previewUrl: danbooruMediaUrlSchema.nullable(),
	sampleUrl: danbooruMediaUrlSchema.nullable(),
	fileUrl: danbooruMediaUrlSchema.nullable(),
	fileExt: z.string(),
	width: z.number().int().nonnegative(),
	height: z.number().int().nonnegative(),
	fileSize: z.number().int().nonnegative(),
	rating: z.string(),
	score: z.number().int(),
	createdAt: z.iso.datetime({ offset: true }),
	source: z.string(),
	tags: z.object({
		general: z.array(z.string()),
		artist: z.array(z.string()),
		copyright: z.array(z.string()),
		character: z.array(z.string()),
		meta: z.array(z.string()),
	}),
});
export type DanbooruPost = z.infer<typeof danbooruPostSchema>;

export const danbooruSearchSchema = z.object({
	tags: z.string().trim().max(1000).default(""),
	page: z.number().int().min(1).max(1000).default(1),
	limit: z.number().int().min(1).max(100).default(40),
});
export type DanbooruSearch = z.infer<typeof danbooruSearchSchema>;
export const danbooruSearchResultSchema = z.object({
	posts: z.array(danbooruPostSchema),
	hasNextPage: z.boolean(),
});
export type DanbooruSearchResult = z.infer<typeof danbooruSearchResultSchema>;

export const danbooruTagSchema = z.object({
	name: z.string(),
	category: z.number().int(),
	postCount: z.number().int().nonnegative(),
});
export type DanbooruTag = z.infer<typeof danbooruTagSchema>;
export const danbooruTagSearchSchema = z.object({
	query: z.string().trim().min(1).max(100),
});
export const danbooruPostRequestSchema = z.object({
	id: z.number().int().positive(),
});
