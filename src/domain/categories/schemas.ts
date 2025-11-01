/**
 * Categories Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No category-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future category domain schemas
 */

import { z } from "zod";

export const categoryDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  parentId: z.number().int().optional(),
});
export type CategoryData = z.infer<typeof categoryDataSchema>;
