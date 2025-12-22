/**
 * Categories Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No category-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future category domain schemas
 */

import { z } from "zod";

export const newCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = newCategorySchema.partial();

export type NewCategory = z.infer<typeof newCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
