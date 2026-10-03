import { z } from "zod";

export const authorPlatformSchema = z.enum([
	"twitter",
	"pixiv-fanbox",
	"danbooru",
]);
export type AuthorPlatform = z.infer<typeof authorPlatformSchema>;

export const authorAccountSchema = z.object({
	id: z.uuid(),
	authorId: z.uuid(),
	// Null means that the platform of legacy metadata is unknown.
	platform: authorPlatformSchema.nullable(),
	// Legacy accountId denotes the mutable handle/creator slug, never a Twitter user ID.
	accountId: z.string().min(1),
	remoteId: z.string().nullable(),
	displayName: z.string().nullable(),
	profileUrl: z.url().nullable(),
	observedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type AuthorAccount = z.infer<typeof authorAccountSchema>;

export const twitterUsernameSchema = z
	.string()
	.trim()
	.transform((value) => value.replace(/^@/, ""))
	.pipe(
		z
			.string()
			.regex(/^[A-Za-z0-9_]{1,15}$/, "Xのユーザー名を指定してください。"),
	);
export const twitterProfileSchema = z.object({
	remoteId: z.string().regex(/^[0-9]+$/),
	username: twitterUsernameSchema,
	displayName: z.string().trim().min(1).max(200),
});
export type TwitterProfile = z.infer<typeof twitterProfileSchema>;
export const beginAuthorAccountVerificationSchema = z.object({
	authorId: z.uuid(),
	accountId: z.uuid().nullable(),
	username: twitterUsernameSchema,
});
export type BeginAuthorAccountVerificationInput = z.infer<
	typeof beginAuthorAccountVerificationSchema
>;
export const authorAccountVerificationIdSchema = z.object({
	verificationId: z.uuid(),
});
export const submitAuthorAccountVerificationSchema =
	authorAccountVerificationIdSchema.extend({ profile: twitterProfileSchema });
export const authorAccountVerificationSchema = z.object({
	verificationId: z.uuid(),
	profileUrl: z.url(),
	expiresAt: z.coerce.date(),
	profile: twitterProfileSchema.nullable(),
	confirmed: z.boolean(),
	error: z.string().nullable(),
});
export type AuthorAccountVerification = z.infer<
	typeof authorAccountVerificationSchema
>;
// The expected version comes from the server-side preview, never from a client edit.
export const confirmAuthorAccountSchema = beginAuthorAccountVerificationSchema
	.omit({ username: true })
	.extend({
		expectedUpdatedAt: z.coerce.date(),
		profile: twitterProfileSchema,
		observedAt: z.coerce.date(),
	});
export type ConfirmAuthorAccountInput = z.infer<
	typeof confirmAuthorAccountSchema
>;

export const authorSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1),
	// Compatibility projection, derived from accounts; not stored on authors.
	accountId: z.string().nullable(),
	accounts: z.array(authorAccountSchema).optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});
export type Author = z.infer<typeof authorSchema>;

export const authorAccountInputSchema = authorAccountSchema
	.pick({
		platform: true,
		accountId: true,
		remoteId: true,
		displayName: true,
		profileUrl: true,
		observedAt: true,
	})
	.refine((value) => !value.remoteId || Boolean(value.platform), {
		message: "固定IDにはプラットフォームが必要です。",
	})
	.refine(
		(value) =>
			value.platform !== "twitter" ||
			!value.remoteId ||
			/^[0-9]+$/.test(value.remoteId),
		{ message: "Twitterの固定IDには数値のユーザーIDを指定してください。" },
	);
export type AuthorAccountInput = z.infer<typeof authorAccountInputSchema>;

export const newAuthorSchema = z
	.object({
		name: z.string().trim().min(1),
		accounts: z.array(authorAccountInputSchema).max(100).optional(),
		accountId: z.string().trim().min(1).nullable().optional(),
		platform: authorPlatformSchema.optional(),
		remoteId: z.string().trim().min(1).nullable().optional(),
		profileUrl: z.url().nullable().optional(),
		observedAt: z.coerce.date().optional(),
	})
	.refine(
		(value) => !value.remoteId || Boolean(value.platform && value.accountId),
		{
			message: "固定IDにはプラットフォームとユーザー名が必要です。",
		},
	)
	.refine(
		(value) =>
			value.platform !== "twitter" ||
			!value.remoteId ||
			/^[0-9]+$/.test(value.remoteId),
		{
			message: "Twitterの固定IDには数値のユーザーIDを指定してください。",
		},
	);
export type NewAuthor = z.infer<typeof newAuthorSchema>;

export const authorMediaListInputSchema = z.object({
	authorId: z.uuid(),
	mediaSourceId: z.uuid().optional(),
	offset: z.number().int().min(0).default(0),
	limit: z.number().int().min(1).max(100).default(50),
});
export type AuthorMediaListInput = z.infer<typeof authorMediaListInputSchema>;
export const authorMediaSchema = z.object({
	id: z.uuid(),
	mediaSourceId: z.uuid(),
	fileName: z.string(),
	modifiedAt: z.coerce.date(),
	authors: z.array(authorSchema),
	sourceUrls: z.array(z.string()),
});
export type AuthorMedia = z.infer<typeof authorMediaSchema>;
export const authorMediaPageSchema = z.object({
	items: z.array(authorMediaSchema),
	total: z.number().int(),
});
export type AuthorMediaPage = z.infer<typeof authorMediaPageSchema>;
export const correctMediaAuthorsSchema = z
	.object({
		mediaIds: z.array(z.uuid()).min(1).max(100),
		sourceAuthorId: z.uuid(),
		targetAuthorId: z.uuid().nullable(),
	})
	.refine((value) => value.sourceAuthorId !== value.targetAuthorId, {
		message: "修正前後の作者を別々に指定してください。",
	});
export type CorrectMediaAuthorsInput = z.infer<
	typeof correctMediaAuthorsSchema
>;
export const mergeAuthorsSchema = z
	.object({ sourceAuthorId: z.uuid(), targetAuthorId: z.uuid() })
	.refine((value) => value.sourceAuthorId !== value.targetAuthorId, {
		message: "統合前後の作者を別々に指定してください。",
	});
export type MergeAuthorsInput = z.infer<typeof mergeAuthorsSchema>;
export const updateAuthorNameSchema = z.object({
	id: z.uuid(),
	name: z.string().trim().min(1),
});
export const authorChangeResultSchema = z.object({
	changedCount: z.number().int().min(0),
});
