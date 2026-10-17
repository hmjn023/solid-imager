import { z } from "zod";
export const sourceRunKindSchema = z.enum(["sync", "export", "restore"]);
export type SourceRunKind = z.infer<typeof sourceRunKindSchema>;
export const sourceRunStatusSchema = z.enum([
	"pending",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
	"blocked",
]);
export const sourceRunInputSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("sync"),
		sourcePath: z.string(),
		generation: z.number().int().nonnegative(),
	}),
	z.object({
		kind: z.literal("export"),
		mode: z.enum(["ndjson", "tar"]),
		includeImages: z.boolean(),
		sourceRevision: z.string(),
	}),
	z.object({
		kind: z.literal("restore"),
		mode: z.enum(["ndjson", "tar"]),
		inputPath: z.string(),
		inputDigest: z.string(),
		inputSize: z.number().int().nonnegative(),
		sourceRevision: z.string(),
	}),
]);
export type SourceRunInput = z.infer<typeof sourceRunInputSchema>;
export const sourceRunCheckpointSchema = z.object({
	offset: z.number().int().nonnegative().default(0),
	added: z.number().int().nonnegative().default(0),
	deleted: z.number().int().nonnegative().default(0),
	processed: z.number().int().nonnegative().default(0),
	skipped: z.number().int().nonnegative().default(0),
	filesComplete: z.boolean().default(false),
	fileCursor: z.string().nullable().default(null),
});
export type SourceRunCheckpoint = z.infer<typeof sourceRunCheckpointSchema>;
export const sourceRunArtifactSchema = z.object({
	path: z.string(),
	fileName: z.string(),
	contentType: z.string(),
	size: z.number().int().nonnegative(),
	expiresAt: z.coerce.date(),
});
export type SourceRunArtifact = z.infer<typeof sourceRunArtifactSchema>;
export const sourceRunSchema = z.object({
	id: z.uuid(),
	sourceId: z.uuid().nullable(),
	kind: sourceRunKindSchema,
	input: sourceRunInputSchema.nullable(),
	status: sourceRunStatusSchema,
	checkpoint: sourceRunCheckpointSchema,
	artifact: sourceRunArtifactSchema.nullable(),
	failureCode: z.string().nullable(),
	attemptCount: z.number().int().nonnegative(),
	maxAttempts: z.number().int().positive(),
	leaseToken: z.uuid().nullable(),
	leaseExpiresAt: z.coerce.date().nullable(),
	retentionExpiresAt: z.coerce.date().nullable(),
	cancelRequestedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	startedAt: z.coerce.date().nullable(),
	finishedAt: z.coerce.date().nullable(),
});
export type SourceRun = z.infer<typeof sourceRunSchema>;
export const sourceRunClaimSchema = sourceRunSchema.extend({
	sourceId: z.uuid(),
	input: sourceRunInputSchema,
	leaseToken: z.uuid(),
	leaseExpiresAt: z.coerce.date(),
});
export type SourceRunClaim = z.infer<typeof sourceRunClaimSchema>;
export const sourceSyncWatermarkSchema = z.object({
	sourceId: z.uuid(),
	generation: z.number().int().nonnegative(),
	requestedGeneration: z.number().int().nonnegative(),
	appliedGeneration: z.number().int().nonnegative(),
});
export type SourceSyncWatermark = z.infer<typeof sourceSyncWatermarkSchema>;
export const safeSourceRunSchema = sourceRunSchema
	.pick({
		id: true,
		sourceId: true,
		kind: true,
		status: true,
		attemptCount: true,
		createdAt: true,
		updatedAt: true,
		finishedAt: true,
	})
	.extend({
		progress: sourceRunCheckpointSchema.omit({
			offset: true,
			fileCursor: true,
		}),
		artifact: sourceRunArtifactSchema.omit({ path: true }).nullable(),
		failureCode: z
			.enum([
				"source_failed",
				"source_changed",
				"legacy_blocked",
				"input_expired",
			])
			.nullable(),
		canRetry: z.boolean(),
		canCancel: z.boolean(),
	});
export type SafeSourceRun = z.infer<typeof safeSourceRunSchema>;
export const sourceRunListSchema = z.object({
	sourceId: z.uuid().optional(),
	kind: sourceRunKindSchema.optional(),
	status: sourceRunStatusSchema.optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().nonnegative().default(0),
});
export const retiredSourceJobTypes = [
	"source_export",
	"source_restore",
	"sync_lancedb",
	"sync_lancedb_full",
	"sync_lancedb_delta",
] as const;
export class SourceRunAttemptLostError extends Error {
	constructor() {
		super("Source operation lease is no longer active");
		this.name = "SourceRunAttemptLostError";
	}
}
