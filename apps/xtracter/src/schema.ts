import { z } from "zod";
import { ugoiraMetadataSchema } from "@solid-imager/core/media";
import {
	authorPlatformSchema,
	submitAuthorAccountVerificationSchema,
} from "@solid-imager/core/authors";

export const submitAccountVerificationMessageSchema =
	submitAuthorAccountVerificationSchema.extend({
		type: z.literal("SUBMIT_ACCOUNT_VERIFICATION"),
	});

export const authorSchema = z.object({
	name: z.string(),
	accountId: z.string().nullable().optional(),
	remoteId: z.string().nullable().optional(),
	profileUrl: z.url().optional(),
	observedAt: z.iso.datetime().optional(),
	platform: authorPlatformSchema.optional(),
});

export type Author = z.infer<typeof authorSchema>;

export const downloadItemSchema = z.object({
	// Required for download
	targetUrl: z.string(),

	// Metadata
	description: z.string().nullable().optional(),
	createdAt: z.string().optional(),
	ugoira: ugoiraMetadataSchema.optional(),

	// Relations
	sourceUrls: z.array(z.string()).optional(),
	authors: z.array(authorSchema).optional(),
	tags: z
		.array(
			z.object({
				name: z.string(),
				type: z.enum(["positive", "negative"]).optional(),
				confidence: z.number().optional(),
				source: z.string().optional(),
			}),
		)
		.optional(),
	characters: z
		.array(
			z.object({
				name: z.string(),
				description: z.string().nullable().optional(),
				confidence: z.number().optional(),
				linkedIps: z.array(z.string()).optional(),
				source: z.string().optional(),
			}),
		)
		.optional(),
	ips: z
		.array(
			z.object({
				name: z.string(),
				description: z.string().nullable().optional(),
				confidence: z.number().optional(),
				source: z.string().optional(),
			}),
		)
		.optional(),

	// Technical
	cookies: z.array(z.any()).optional(),
	userAgent: z.string().optional(),
});

export type DownloadItem = z.infer<typeof downloadItemSchema>;

export const downloadMessageSchema = z.object({
	type: z.literal("DOWNLOAD"),
	data: downloadItemSchema,
});

export type DownloadMessage = z.infer<typeof downloadMessageSchema>;

export const downloadBulkMessageSchema = z.object({
	type: z.literal("DOWNLOAD_BULK"),
	data: z.array(downloadItemSchema),
});

export type DownloadBulkMessage = z.infer<typeof downloadBulkMessageSchema>;

export const postDownloadMessageSchema = z.object({
	type: z.literal("POST_DOWNLOAD"),
	data: downloadItemSchema,
});

export type PostDownloadMessage = z.infer<typeof postDownloadMessageSchema>;

export const postBulkMessageSchema = z.object({
	type: z.literal("POST_BULK"),
	data: z.array(downloadItemSchema),
});

export type PostBulkMessage = z.infer<typeof postBulkMessageSchema>;

export const mediaSourceSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
});

export type MediaSource = z.infer<typeof mediaSourceSchema>;

/** One persisted settings object prevents the active URL and server selections tearing apart. */
export const connectionSettingsSchema = z.object({
	apiUrl: z
		.url()
		.refine((url) => ["http:", "https:"].includes(new URL(url).protocol)),
	generation: z.number().int().nonnegative(),
	selectedSourceIds: z.record(z.string(), z.string()),
});
export type ConnectionSettings = z.infer<typeof connectionSettingsSchema>;
export const sourcesResponseSchema = z.discriminatedUnion("success", [
	z.object({
		success: z.literal(true),
		apiUrl: z.string(),
		generation: z.number().int().nonnegative(),
		sources: z.array(mediaSourceSchema),
		selectedSourceId: z.string().nullable(),
	}),
	z.object({ success: z.literal(false), error: z.string() }),
]);
export type SourcesResponse = z.infer<typeof sourcesResponseSchema>;
export const setApiUrlMessageSchema = z.object({
	type: z.literal("SET_API_URL"),
	apiUrl: connectionSettingsSchema.shape.apiUrl,
});
export const setSourceMessageSchema = z.object({
	type: z.literal("SET_SOURCE"),
	apiUrl: connectionSettingsSchema.shape.apiUrl,
	generation: z.number().int().nonnegative(),
	sourceId: z.string(),
});

export const getSourcesMessageSchema = z.object({
	type: z.literal("GET_SOURCES"),
});

export type GetSourcesMessage = z.infer<typeof getSourcesMessageSchema>;

export const getCookiesMessageSchema = z.object({
	type: z.literal("GET_COOKIES"),
	url: z.string(),
});

export type GetCookiesMessage = z.infer<typeof getCookiesMessageSchema>;

export const getMetadataMessageSchema = z.object({
	type: z.literal("GET_METADATA"),
});

export type GetMetadataMessage = z.infer<typeof getMetadataMessageSchema>;

export const downloadJsonMessageSchema = z.object({
	type: z.literal("DOWNLOAD_JSON_FROM_POPUP"),
});

export type DownloadJsonMessage = z.infer<typeof downloadJsonMessageSchema>;

export const messageSchema = z.discriminatedUnion("type", [
	downloadMessageSchema,
	downloadBulkMessageSchema,
	postDownloadMessageSchema,
	postBulkMessageSchema,
]);

export type Message = z.infer<typeof messageSchema>;

export const extendedMessageSchema = z.discriminatedUnion("type", [
	submitAccountVerificationMessageSchema,
	downloadMessageSchema,
	downloadBulkMessageSchema,
	postDownloadMessageSchema,
	postBulkMessageSchema,
	getSourcesMessageSchema,
	setApiUrlMessageSchema,
	setSourceMessageSchema,
	getMetadataMessageSchema,
	downloadJsonMessageSchema,
	getCookiesMessageSchema,
]);

export type ExtendedMessage = z.infer<typeof extendedMessageSchema>;
