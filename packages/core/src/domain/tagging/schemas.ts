import { z } from "zod";

export const taggingResponseSchema = z.object({
  general: z.record(z.string(), z.number()),
  character: z.record(z.string(), z.number()),
  ips: z.array(z.string()),
  // biome-ignore lint/style/useNamingConvention: External API uses snake_case
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

export const ccipBatchDifferenceResponseSchema = z.object({
  differences: z.array(z.array(z.number())),
});

export type CcipBatchDifferenceResponse = z.infer<
  typeof ccipBatchDifferenceResponseSchema
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

export const batchTaggingRequestSchema = z.object({
  force: z.boolean().optional(),
  batchSize: z.number().optional(),
  mediaSourceId: z.string().optional(),
});

export const batchCcipExtractionRequestSchema = z.object({
  force: z.boolean().optional(),
  batchSize: z.number().optional(),
  mediaSourceId: z.string().optional(),
});

export const similarityCalculationRequestSchema = z.object({
  mediaSourceId: z.string().optional(),
  threshold: z.number().optional(),
});
