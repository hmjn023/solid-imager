import { z } from "zod";

export const thumbnailSizeSchema = z.union([z.literal(256), z.literal(512)]);
export type ThumbnailSize = z.infer<typeof thumbnailSizeSchema>;

export const generateThumbnailsRequestSchema = z.object({
	sourceId: z.string().uuid(),
	size: thumbnailSizeSchema.optional().default(512),
	missingOnly: z.boolean().optional().default(false),
});
export type GenerateThumbnailsRequest = z.infer<
	typeof generateThumbnailsRequestSchema
>;

export const generateThumbnailsResponseSchema = z.object({
	success: z.boolean(),
	count: z.number().int().nonnegative(),
	jobId: z.string().uuid().optional(),
	message: z.string(),
});
export type GenerateThumbnailsResponse = z.infer<
	typeof generateThumbnailsResponseSchema
>;

export const generateThumbnailJobPayloadSchema = z.object({
	mediaId: z.string().uuid(),
	size: thumbnailSizeSchema,
});
export type GenerateThumbnailJobPayload = z.infer<
	typeof generateThumbnailJobPayloadSchema
>;
