import { z } from "zod";

export const groupKindSchema = z.enum(["post", "comic", "variant"]);
export const groupStateSchema = z.enum([
	"candidate",
	"tentative",
	"confirmed",
	"rejected",
]);
export const sourcePostSchema = z.object({
	platform: z.enum(["twitter", "pixiv", "fanbox"]),
	postId: z.string().regex(/^\d+$/),
	position: z.number().int().nonnegative().max(100000).nullable().default(null),
});
export type SourcePost = z.infer<typeof sourcePostSchema>;
/** Only recognized permalinks are evidence; timeline/profile/CDN URLs are not posts. */
export function sourcePostFromUrls(urls: string[]): SourcePost | undefined {
	for (const value of urls) {
		try {
			const u = new URL(value);
			if (!["https:", "http:"].includes(u.protocol)) continue;
			let match: RegExpMatchArray | null;
			if (
				["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
					u.hostname,
				) &&
				(match = u.pathname.match(
					/^\/(?:[A-Za-z0-9_]+|i\/web)\/status\/(\d+)(?:\/(?:photo|video)\/(\d+))?\/?$/,
				))
			)
				return {
					platform: "twitter",
					postId: match[1],
					position:
						match[2] && Number(match[2]) > 0 ? Number(match[2]) - 1 : null,
				};
			if (
				u.hostname === "www.pixiv.net" &&
				(match = u.pathname.match(/^\/(?:[a-z]{2}\/)?artworks\/(\d+)\/?$/))
			)
				return { platform: "pixiv", postId: match[1], position: null };
			if (
				(u.hostname === "fanbox.cc" || u.hostname.endsWith(".fanbox.cc")) &&
				(match = u.pathname.match(/^\/posts\/(\d+)\/?$/))
			)
				return { platform: "fanbox", postId: match[1], position: null };
		} catch {
			/* Ignore malformed historical URLs. */
		}
	}
	return undefined;
}
export const groupMemberSchema = z.object({
	mediaId: z.uuid(),
	fileName: z.string(),
	mediaSourceId: z.uuid(),
	position: z.number().int().nullable(),
	state: groupStateSchema,
	origin: z.enum(["manual", "source"]),
});
export const mediaGroupSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	kind: groupKindSchema,
	sourceKey: z.string().nullable(),
	members: z.array(groupMemberSchema),
});
export const createMediaGroupSchema = z.object({
	title: z.string().trim().min(1).max(200),
	kind: groupKindSchema,
	mediaIds: z
		.array(z.uuid())
		.min(1)
		.max(500)
		.refine((ids) => new Set(ids).size === ids.length),
	state: groupStateSchema.default("tentative"),
});
export const setGroupMemberSchema = z.object({
	groupId: z.uuid(),
	mediaId: z.uuid(),
	state: groupStateSchema,
	position: z.number().int().nonnegative().max(100000).nullable(),
});
export type MediaGroup = z.infer<typeof mediaGroupSchema>;
export type GroupMember = z.infer<typeof groupMemberSchema>;
export type CreateMediaGroup = z.infer<typeof createMediaGroupSchema>;
export type SetGroupMember = z.infer<typeof setGroupMemberSchema>;
