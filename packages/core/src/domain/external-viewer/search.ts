import { z } from "zod";

export const externalSearchSchema = z.object({
	tags: z.string().trim().max(1000).default(""),
	page: z.number().int().min(1).max(1000).default(1),
});
export const viewerProviderSchema = z.enum(["danbooru", "pixiv"]);
export type ViewerProvider = z.infer<typeof viewerProviderSchema>;
export type ExternalSearch = z.infer<typeof externalSearchSchema>;
export const viewerRequestSchema = externalSearchSchema.extend({
	provider: viewerProviderSchema,
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
