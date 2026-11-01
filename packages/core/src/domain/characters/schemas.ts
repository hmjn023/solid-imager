/**
 * Characters Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No character-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future character domain schemas
 */

import { z } from "zod";

export const startCharacterClusteringSchema = z
	.object({
		neighbors: z.number().int().min(2).max(256).default(64),
		minClusterSize: z.number().int().min(2).max(10000).default(5),
		minSamples: z.number().int().min(1).max(256).default(3),
		selectionMethod: z.enum(["eom", "leaf"]).default("leaf"),
	})
	.refine((value) => value.minSamples <= value.neighbors, {
		message: "密度の最小サンプル数は近傍数以下にしてください。",
		path: ["minSamples"],
	});
export type StartCharacterClustering = z.infer<
	typeof startCharacterClusteringSchema
>;
export * from "./clustering-schemas";

export const newCharacterSchema = z.object({
	name: z.string().min(1),
	ipIds: z.array(z.uuid()).optional(),
	description: z.string().optional(),
	source: z.string().optional(),
});

export const updateCharacterSchema = newCharacterSchema.partial();

export type NewCharacter = z.infer<typeof newCharacterSchema>;
export type UpdateCharacter = z.infer<typeof updateCharacterSchema>;

export const characterSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	description: z.string().nullable(),
	ips: z.array(z.object({ id: z.uuid(), name: z.string() })).default([]),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	mediaCount: z.number().int().nonnegative().optional(),
});

export type Character = z.infer<typeof characterSchema>;
