/**
 * Characters Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No character-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future character domain schemas
 */

import { z } from "zod";

export const characterDataSchema = z.object({
  name: z.string(),
  ipId: z.number().int().optional(),
  description: z.string().optional(),
});
export type CharacterData = z.infer<typeof characterDataSchema>;
