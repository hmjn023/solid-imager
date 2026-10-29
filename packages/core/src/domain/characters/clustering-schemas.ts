import { z } from "zod";

export const clusteringRunIdSchema = z
	.string()
	.max(160)
	.regex(/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?$/);
const namedCharacterSchema = z.object({ id: z.uuid(), name: z.string() });

/** Shared file schemas used by the CLI writer and the read-only review store. */
export const clusteringSnapshotMediaSchema = z.object({
	embedding_id: z.uuid(),
	media_id: z.uuid(),
	source_id: z.uuid(),
	file_name: z.string(),
	extracted_at: z.string(),
	modified_at: z.string(),
	characters: z.array(namedCharacterSchema),
});
export const clusteringAssignmentSchema = z.object({
	mediaId: z.uuid(),
	embeddingId: z.uuid(),
	extractedAt: z.string(),
	clusterId: z.number().int().min(-1),
	membershipStrength: z.number().min(0).max(1),
});

export const clusteringRunSummarySchema = z.object({
	id: clusteringRunIdSchema,
	name: z.string(),
	completedAt: z.iso.datetime(),
	implementation: z.string(),
	points: z.number().int().nonnegative(),
	clusters: z.number().int().nonnegative(),
	clustered: z.number().int().nonnegative(),
	noise: z.number().int().nonnegative(),
	cohortId: z.string(),
	soloOnly: z.boolean(),
	parameters: z.object({
		neighbors: z.number().int().positive(),
		minClusterSize: z.number().int().min(2),
		minSamples: z.number().int().positive(),
		selectionMethod: z.enum(["eom", "leaf"]),
	}),
});

export const clusteringReviewMediaSchema = z.object({
	id: z.uuid(),
	mediaSourceId: z.uuid(),
	fileName: z.string(),
	modifiedAt: z.string(),
	characters: z.array(namedCharacterSchema),
	clusterId: z.number().int().min(-1),
	membershipStrength: z.number().min(0).max(1),
	comparisonClusterId: z.number().int().min(-1).nullable(),
});
export const clusteringGroupSchema = z.object({
	id: z.number().int().nonnegative(),
	size: z.number().int().positive(),
	meanStrength: z.number().min(0).max(1),
	minimumStrength: z.number().min(0).max(1),
	characters: z.array(
		namedCharacterSchema.extend({ count: z.number().int().positive() }),
	),
	labelKinds: z.number().int().nonnegative(),
	previews: z.array(clusteringReviewMediaSchema),
	comparison: z
		.object({
			clusters: z.number().int().nonnegative(),
			noise: z.number().int().nonnegative(),
			missing: z.number().int().nonnegative(),
		})
		.nullable(),
});

const pageInput = z.object({
	runId: clusteringRunIdSchema,
	comparisonRunId: clusteringRunIdSchema.optional(),
	query: z.string().max(200).default(""),
	offset: z.number().int().min(0).default(0),
	limit: z.number().int().min(1).max(60).default(24),
});
export const clusteringGroupsRequestSchema = pageInput.extend({
	sort: z.enum(["size", "mixed", "weak"]).default("size"),
});
export const clusteringMediaRequestSchema = pageInput.extend({
	clusterId: z.number().int().min(-1),
	order: z.enum(["weak", "strong", "name"]).default("weak"),
});
export const clusteringGroupsResponseSchema = z.object({
	groups: z.array(clusteringGroupSchema),
	total: z.number().int().nonnegative(),
});
export const clusteringMediaResponseSchema = z.object({
	media: z.array(clusteringReviewMediaSchema),
	total: z.number().int().nonnegative(),
});

export type ClusteringRunSummary = z.infer<typeof clusteringRunSummarySchema>;
export type ClusteringReviewMedia = z.infer<typeof clusteringReviewMediaSchema>;
export type ClusteringGroup = z.infer<typeof clusteringGroupSchema>;
export type ClusteringSnapshotMedia = z.infer<
	typeof clusteringSnapshotMediaSchema
>;
export type ClusteringAssignment = z.infer<typeof clusteringAssignmentSchema>;
export type ClusteringGroupsRequest = z.infer<
	typeof clusteringGroupsRequestSchema
>;
export type ClusteringMediaRequest = z.infer<
	typeof clusteringMediaRequestSchema
>;
export type ClusteringGroupsResponse = z.infer<
	typeof clusteringGroupsResponseSchema
>;
export type ClusteringMediaResponse = z.infer<
	typeof clusteringMediaResponseSchema
>;
