import { z } from "zod";

export const authorSchema = z.object({
	name: z.string(),
	accountId: z.string().nullable().optional(),
});

export type Author = z.infer<typeof authorSchema>;

export const downloadItemSchema = z.object({
	// Required for download
	targetUrl: z.string(),

	// Metadata
	description: z.string().nullable().optional(),
	createdAt: z.string().optional(), // ISO string

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

// Alias for backward compatibility
export type TweetMetadata = DownloadItem;

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
	downloadMessageSchema,
	downloadBulkMessageSchema,
	postDownloadMessageSchema,
	postBulkMessageSchema,
	getSourcesMessageSchema,
	getMetadataMessageSchema,
	downloadJsonMessageSchema,
	getCookiesMessageSchema,
]);

export type ExtendedMessage = z.infer<typeof extendedMessageSchema>;
