import { z } from "zod";
import { downloadItemSchema } from "../media/schemas";
import { batchParentPayloadSchema } from "../tagging/schemas";

export const JOB_TYPES = [
  "processMedia",
  "downloadImage",
  "auto_tagging",
  "extract_ccip_vector",
  "bulk_tagging_parent",
  "bulk_tagging_dispatch",
  "batch_ccip_parent",
  "batch_ccip_dispatch",
  "import_request",
  "sync_lancedb",
  "sync_lancedb_full",
  "sync_lancedb_delta",
] as const;

export const jobTypeSchema = z.enum(JOB_TYPES);
export type JobType = z.infer<typeof jobTypeSchema>;

export const jobStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobQueueNameSchema = z.enum(["default", "ai"]);
export type JobQueueName = z.infer<typeof jobQueueNameSchema>;

const processMediaPayloadSchema = z.object({
  mediaId: z.string().uuid(),
  sourcePath: z.string().min(1),
  type: z.literal("processMedia").optional(),
  skipMetadataExtraction: z.boolean().optional(),
});

const downloadImagePayloadSchema = downloadItemSchema
  .extend({
    imageUrl: z.string().url().optional(),
    sourceUrl: z.string().url().optional(),
  })
  .refine(
    (payload) => typeof payload.targetUrl === "string" || typeof payload.imageUrl === "string",
    { message: "downloadImage requires targetUrl or imageUrl" },
  );

const autoTaggingPayloadSchema = z.object({
  mediaId: z.string().uuid(),
  force: z.boolean().optional(),
});

const singleCcipPayloadSchema = z.object({
  mediaId: z.string().uuid(),
  force: z.boolean().optional().default(false),
});

const batchCcipPayloadSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1).max(25),
  force: z.boolean().optional().default(false),
});

const ccipPayloadSchema = z.union([singleCcipPayloadSchema, batchCcipPayloadSchema]);

const dispatchPayloadSchema = z.object({
  force: z.boolean().optional().default(false),
  batchSize: z.number().int().positive().max(5000).optional(),
  mediaSourceId: z.string().uuid().optional(),
});

const fullSyncPayloadSchema = z
  .object({
    reason: z.string().optional(),
    batchSize: z.number().int().positive().optional(),
    delayMs: z.number().int().nonnegative().optional(),
  })
  .optional()
  .nullable();

const deltaSyncPayloadSchema = z.object({
  reason: z.string().optional(),
  batchSize: z.number().int().positive().optional(),
  mediaId: z.string().uuid().optional(),
  mediaIds: z.array(z.string().uuid()).optional(),
  operation: z.enum(["upsert", "delete"]).optional(),
});

/**
 * Runtime source of truth for every durable job payload.
 *
 * The database intentionally keeps `jobs.type` as text so a worker can mark an
 * unknown legacy row as a non-retryable failure instead of failing to read it.
 */
export const jobEnvelopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("processMedia"), payload: processMediaPayloadSchema }),
  z.object({
    type: z.literal("downloadImage"),
    payload: downloadImagePayloadSchema,
  }),
  z.object({
    type: z.literal("auto_tagging"),
    payload: autoTaggingPayloadSchema,
  }),
  z.object({
    type: z.literal("extract_ccip_vector"),
    payload: ccipPayloadSchema,
  }),
  z.object({
    type: z.literal("bulk_tagging_parent"),
    payload: batchParentPayloadSchema,
  }),
  z.object({
    type: z.literal("bulk_tagging_dispatch"),
    payload: dispatchPayloadSchema,
  }),
  z.object({
    type: z.literal("batch_ccip_parent"),
    payload: batchParentPayloadSchema,
  }),
  z.object({
    type: z.literal("batch_ccip_dispatch"),
    payload: dispatchPayloadSchema,
  }),
  z.object({
    type: z.literal("import_request"),
    payload: downloadItemSchema,
  }),
  z.object({ type: z.literal("sync_lancedb"), payload: fullSyncPayloadSchema }),
  z.object({
    type: z.literal("sync_lancedb_full"),
    payload: fullSyncPayloadSchema,
  }),
  z.object({
    type: z.literal("sync_lancedb_delta"),
    payload: deltaSyncPayloadSchema,
  }),
]);

export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;

export const safeJobProgressSchema = z.object({
	processed: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
});

export const safeJobSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  status: jobStatusSchema,
  queueName: jobQueueNameSchema.nullable(),
  targetId: z.string().nullable(),
  inputRevision: z.string().nullable(),
  attemptCount: z.number().int().nonnegative(),
	maxAttempts: z.number().int().positive(),
	errorCode: z.string().nullable(),
	errorMessage: z.string().nullable(),
	progress: safeJobProgressSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  parentId: z.string().uuid().nullable(),
});
export type SafeJob = z.infer<typeof safeJobSchema>;

export function getSafeJobErrorMessage(errorCode: string | null): string | null {
	if (!errorCode) return null;
	if (errorCode === "INVALID_JOB_PAYLOAD") return "The job payload is invalid.";
	if (errorCode === "UNKNOWN_JOB_TYPE") return "The job type is not supported.";
	if (errorCode === "STALE_INPUT") return "The job input is no longer current.";
	if (errorCode === "TARGET_NOT_FOUND") return "The job target no longer exists.";
	if (errorCode === "LEASE_EXPIRED") return "The job worker lease expired.";
	if (errorCode === "DISPATCH_FAILED") return "The batch dispatcher failed.";
	return "The job failed.";
}
