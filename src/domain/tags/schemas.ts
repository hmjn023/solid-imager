/**
 * Tags Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No tag-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future tag domain schemas
 */

import { boolean, number, string, z } from "zod";

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
  widgetValues: z.array(z.string()).optional(),
  title: z.string().optional(),
});
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowSchema = z.object({
  nodes: z.array(workflowNodeSchema),
});
export type Workflow = z.infer<typeof workflowSchema>;
