import { z } from "zod";

export const taggingResponseSchema = z.object({
	general: z.record(z.string(), z.number()),
	character: z.record(z.string(), z.number()),
	ips: z.array(z.string()),
	ips_mapping: z.record(z.string(), z.array(z.string())),
});

export type TaggingResponse = z.infer<typeof taggingResponseSchema>;

export const ccipFeatureResponseSchema = z.object({
	feature: z.array(z.number()),
});

export type CcipFeatureResponse = z.infer<typeof ccipFeatureResponseSchema>;

export const ccipDifferenceResponseSchema = z.object({
	difference: z.number(),
});

export type CcipDifferenceResponse = z.infer<
	typeof ccipDifferenceResponseSchema
>;

// Request schemas for API
export const tagImageRequestSchema = z.object({
	mediaSourceId: z.string().optional(),
	mediaId: z.string().optional(),
});

export const ccipFeatureRequestSchema = z.object({
	mediaSourceId: z.string().optional(),
	mediaId: z.string().optional(),
});

export const ccipDifferenceRequestSchema = z.object({
	feature1: z.array(z.number()),
	feature2: z.array(z.number()),
});

export const ccipDistancesRequestSchema = z.object({
	feature: z.array(z.number()).length(768),
	candidates: z.array(z.array(z.number()).length(768)),
});

export const ccipDistancesResponseSchema = z.object({
	distances: z.array(z.number()),
});

export const ccipVectorStatusSchema = z.object({
	status: z.enum(["missing", "processing", "ready", "stale", "failed"]),
	jobId: z.string().uuid().optional(),
	model: z.string().optional(),
	extractedAt: z.coerce.date().optional(),
	error: z.string().optional(),
});

export type CcipVectorStatus = z.infer<typeof ccipVectorStatusSchema>;

export const ccipExtractionRequestSchema = z.object({
	mediaSourceId: z.string().uuid(),
	mediaId: z.string().uuid(),
	force: z.boolean().default(false),
});

export const batchCcipExtractionRequestSchema = z.object({
	force: z.boolean().default(false),
	mediaSourceId: z.string().uuid().optional(),
});

export const startCcipExtractionResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	jobId: z.string().uuid(),
});

export type StartCcipExtractionResponse = z.infer<
	typeof startCcipExtractionResponseSchema
>;

export const similarMediaRequestSchema = z.object({
	anchorMediaId: z.string().uuid(),
	mediaSourceId: z.string().uuid().optional(),
	topK: z.number().int().min(1).max(100).default(50),
});

export const similarMediaScoreSchema = z.object({
	mediaId: z.string().uuid(),
	cosineDistance: z.number(),
	ccipDistance: z.number(),
});

export type SimilarMediaScore = z.infer<typeof similarMediaScoreSchema>;

export const batchTaggingRequestSchema = z.object({
	force: z.boolean().optional(),
	batchSize: z.number().optional(),
	mediaSourceId: z.string().optional(),
});

export const napiBBoxSchema = z.object({
	x1: z.number(),
	y1: z.number(),
	x2: z.number(),
	y2: z.number(),
});

export type NapiBBox = z.infer<typeof napiBBoxSchema>;

export const characterCropSchema = z.object({
	index: z.number(),
	bbox: napiBBoxSchema,
	label: z.string(),
	score: z.number(),
	imageBase64: z.string(),
	width: z.number(),
	height: z.number(),
	format: z.enum(["webp", "png"]).optional(),
});

export type CharacterCrop = z.infer<typeof characterCropSchema>;

export const detectAndCropRequestSchema = z.object({
	mediaId: z.string().uuid(),
	transparent: z.boolean().optional().default(false),
});

export const detectAndCropResponseSchema = z.object({
	detections: z.array(characterCropSchema),
});

export type DetectAndCropResponse = z.infer<typeof detectAndCropResponseSchema>;

export const startBatchTaggingResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	jobId: z.string().uuid(),
});

export type StartBatchTaggingResponse = z.infer<
	typeof startBatchTaggingResponseSchema
>;
