/**
 * Characters Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No character-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future character domain schemas
 */

import { z } from "zod";

export const newCharacterSchema = z.object({
  name: z.string().min(1),
  ipId: z.string().uuid().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
});

export const updateCharacterSchema = newCharacterSchema.partial();

export type NewCharacter = z.infer<typeof newCharacterSchema>;
export type UpdateCharacter = z.infer<typeof updateCharacterSchema>;

export const characterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  ipId: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Character = z.infer<typeof characterSchema>;
