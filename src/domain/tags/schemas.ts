/**
 * Tags Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No tag-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future tag domain schemas
 */

import { z } from "zod";

export const tagDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  attribute: z.string().optional(),
  color: z.string().optional(),
  source: z.string().optional(),
});
export type TagData = z.infer<typeof tagDataSchema>;

export const TagsSchema = z.object({
  positiveTags: z.array(tagDataSchema),
  negativeTags: z.array(tagDataSchema),
});

export type Tags = z.infer<typeof TagsSchema>;

export const workflowNodeSchema = z.object({
  type: z.string(),
  // biome-ignore lint/style/useNamingConvention: ComfyUI uses snake_case.
  widgets_values: z.array(z.any()).optional(),
  title: z.string().optional(),
});
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowSchema = z.object({
  nodes: z.array(workflowNodeSchema),
});
export type Workflow = z.infer<typeof workflowSchema>;

export const newTagSchema = tagDataSchema.extend({
  name: z.string().min(1, "Tag name cannot be empty"),
});

export const updateTagSchema = tagDataSchema.partial();

/**
 * Zod schema for tag API response (frontend)
 * Used for validating tag data returned from the API
 */
export const tagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  attribute: z.string().nullable(),
  color: z.string().nullable(),
  source: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TagResponse = z.infer<typeof tagResponseSchema>;

/**
 * Zod schema for tag list API response
 */
export const tagListResponseSchema = z.array(tagResponseSchema);
export type TagListResponse = z.infer<typeof tagListResponseSchema>;
