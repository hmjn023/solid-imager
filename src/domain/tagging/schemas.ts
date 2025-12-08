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

export type CCIPFeatureResponse = z.infer<typeof ccipFeatureResponseSchema>;

export const ccipDifferenceResponseSchema = z.object({
  difference: z.number(),
});

export type CCIPDifferenceResponse = z.infer<
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
