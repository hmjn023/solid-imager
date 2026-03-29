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

export const workflowNodeSchema = z
	.object({
		type: z.string().optional(),
		class_type: z.string().optional(),
		widgets_values: z.array(z.any()).optional(),
		inputs: z.record(z.string(), z.any()).optional(),
		title: z.string().optional(),
	})
	.passthrough();
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowSchema = z
	.object({
		nodes: z.array(workflowNodeSchema).optional(),
	})
	.passthrough();
export type Workflow = z.infer<typeof workflowSchema>;

export const newTagSchema = tagDataSchema.extend({
	name: z.string().min(1, "Tag name cannot be empty"),
});
export type NewTag = z.infer<typeof newTagSchema>;

export const updateTagSchema = tagDataSchema.partial();
export type UpdateTag = z.infer<typeof updateTagSchema>;

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
	authorId: z.string().uuid().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type TagResponse = z.infer<typeof tagResponseSchema>;

/**
 * Zod schema for tag list API response
 */
export const tagListResponseSchema = z.array(tagResponseSchema);
export type TagListResponse = z.infer<typeof tagListResponseSchema>;
