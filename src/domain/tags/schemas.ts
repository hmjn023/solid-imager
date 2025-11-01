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
  source: z.string().optional(), // Added based on database design
});
export type TagData = z.infer<typeof tagDataSchema>;
