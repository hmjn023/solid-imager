import { z } from "zod";
import {
	clusteringSnapshotMediaSchema,
	clusteringAssignmentSchema,
} from "@solid-imager/core/domain/characters/schemas";

export const optionsSchema = z.object({
	neighbors: z.number().int().min(1).optional(),
	minClusterSize: z.number().int().min(2).default(5),
	minSamples: z.number().int().min(1).default(3),
	selectionMethod: z.enum(["eom", "leaf"]).default("leaf"),
});

export const graphManifestSchema = z
	.object({
		formatVersion: z.literal(1),
		status: z.enum(["extracting", "failed", "complete"]),
		metric: z.literal("cosine"),
		model: z.string(),
		embeddingVersion: z.number().int(),
		points: z.number().int().min(2),
		neighbors: z.number().int().min(1),
		checksums: z.object({
			"media.jsonl": z.string(),
			"indices.npy": z.string(),
			"distances.npy": z.string(),
		}),
	})
	.loose();

export const mediaRecordSchema = clusteringSnapshotMediaSchema;
export type MediaRecord = z.infer<typeof mediaRecordSchema>;

export const assignmentSchema = clusteringAssignmentSchema;

export type ClusteringOptions = z.infer<typeof optionsSchema>;
