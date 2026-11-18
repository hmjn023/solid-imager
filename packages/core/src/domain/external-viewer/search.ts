import { z } from "zod";

export const pixivFeedSchema = z.enum([
	"daily",
	"weekly",
	"monthly",
	"rookie",
	"follow",
]);
export type PixivFeed = z.infer<typeof pixivFeedSchema>;

export const pixivBookmarkVisibilitySchema = z.enum(["public", "private"]);
export const pixivBookmarkFilterSchema = z.object({
	visibility: pixivBookmarkVisibilitySchema,
	tag: z.string().max(200).default(""),
});
export type PixivBookmarkFilter = z.infer<typeof pixivBookmarkFilterSchema>;

export const externalSearchSchema = z.object({
	pixivFeed: pixivFeedSchema.optional(),
	tags: z.string().trim().max(1000).default(""),
	page: z.number().int().min(1).max(1000).default(1),
});
export const viewerProviderSchema = z.enum(["danbooru", "pixiv"]);
export type ViewerProvider = z.infer<typeof viewerProviderSchema>;
export type ExternalSearch = z.infer<typeof externalSearchSchema>;
export const pixivBookmarksRequestSchema = pixivBookmarkFilterSchema.extend({
	page: externalSearchSchema.shape.page,
});
export type PixivBookmarksRequest = z.infer<typeof pixivBookmarksRequestSchema>;
export const viewerRequestSchema = externalSearchSchema.extend({
	provider: viewerProviderSchema,
	literalPixivTag: z.boolean().optional(),
	pixivUserId: z
		.string()
		.regex(/^[1-9]\d*$/)
		.max(30)
		.optional(),
	choices: z
		.record(z.string().min(1).max(200), z.string().min(1).max(200))
		.optional(),
});
export const viewerTagSchema = z.object({
	name: z.string(),
	category: z.number().int().nullable(),
	postCount: z.number().int().nonnegative().nullable(),
});
export type ViewerTag = z.infer<typeof viewerTagSchema>;
export const tagMappingSchema = z.object({
	tag: z.string(),
	names: z.array(z.string()),
	selected: z.string(),
	source: z.enum(["wiki", "snapshot", "literal"]),
});
export type TagMapping = z.infer<typeof tagMappingSchema>;
