/**
 * Categories Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

export const newCategorySchema = z.object({
	name: z.string().min(1),
	description: z.string().optional().nullable(),
	color: z.string().optional().nullable(),
	parentId: z.string().uuid().optional().nullable(),
});

export const categorySchema = newCategorySchema.extend({
	id: z.string().uuid(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const updateCategorySchema = newCategorySchema.partial();

export type Category = z.infer<typeof categorySchema>;
export type NewCategory = z.infer<typeof newCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
