import { z } from "zod";
import { TAG_DICTIONARY_JOB } from "../tags/dictionary-job";
import { importWorkProgressSchema } from "./import-batch";

export const jobStatusSchema = z.enum([
	"pending",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

/** A processor's proposed outcome; cancellation is resolved atomically in storage. */
export const jobAttemptOutcomeSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("completed"), result: z.unknown() }),
	z.object({ status: z.literal("failed"), error: z.string() }),
	z.object({ status: z.literal("cancelled") }),
]);
export type JobAttemptOutcome = z.infer<typeof jobAttemptOutcomeSchema>;
export const jobTerminalStatusSchema = z.enum([
	"completed",
	"failed",
	"cancelled",
]);
export type JobTerminalStatus = z.infer<typeof jobTerminalStatusSchema>;

/** Job types whose progress is aggregated from child jobs. */
export const batchParentJobTypes = [
	"batch_ccip_parent",
	"bulk_tagging_parent",
	"thumbnail_generation_parent",
	"import_batch_parent",
	"batch_embedding_parent",
] as const;

/** Tests whether a job type represents a batch parent. */
export function isBatchParentJobType(type: string): boolean {
	return batchParentJobTypes.some((parentType) => parentType === type);
}

/** These parents keep one target record per input and durable work for each stage. */
export function hasBatchTargetHistory(type: string) {
	return type === "import_batch_parent" || type === "batch_embedding_parent";
}

export function canCancelJobType(type: string) {
	return (
		hasBatchTargetHistory(type) ||
		(!isBatchParentJobType(type) && type !== "import_batch_target")
	);
}

/** Batch history and approval requests cannot be retried as standalone worker jobs. */
export function canRetryJob(job: {
	status: string;
	type?: string;
	parentId?: string | null;
	progress?: { failed: number } | null;
}): boolean {
	if (job.type && hasBatchTargetHistory(job.type))
		return (
			(job.status === "failed" || job.status === "cancelled") &&
			!job.parentId &&
			(job.progress?.failed ?? 1) > 0
		);
	return (
		job.status === "failed" &&
		!job.parentId &&
		job.type !== "import_request" &&
		job.type !== "import_batch_target" &&
		job.type !== "extract_embedding_batch" &&
		job.type !== TAG_DICTIONARY_JOB &&
		!isBatchParentJobType(job.type ?? "")
	);
}

/** Batch counts, or null when progress is unavailable for the job. */
const jobProgressCountsSchema = z.object({
	processed: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	cancelled: z.number().int().nonnegative().optional(),
	total: z.number().int().nonnegative(),
});

export const jobProgressSchema = jobProgressCountsSchema
	.extend({
		importWork: importWorkProgressSchema
			.optional()
			.describe("Work counts and overall progress for an active import."),
	})
	.nullable();

/**
 * Public job representation. Raw payload/result JSON is deliberately omitted
 * because job payloads may contain local paths or other implementation data.
 */
export const jobDtoSchema = z.object({
	id: z.uuid(),
	type: z.string(),
	mediaSourceId: z.uuid().nullable(),
	status: jobStatusSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	parentId: z.uuid().nullable(),
	error: z.string().nullable(),
	cancelRequestedAt: z.coerce.date().nullable(),
	cancelledAt: z.coerce.date().nullable(),
	attemptCount: z.number().int().nonnegative(),
	startedAt: z.coerce.date().nullable(),
	finishedAt: z.coerce.date().nullable(),
	targetMediaId: z.uuid().nullable(),
	targetMediaModifiedAt: z.coerce.date().nullable(),
	progress: jobProgressSchema,
	artifact: z
		.object({
			fileName: z.string(),
			contentType: z.string(),
			size: z.number().int().nonnegative().nullable(),
		})
		.nullable(),
});
export type JobDto = z.infer<typeof jobDtoSchema>;

/** Job listing filtered before pagination and counting. Active includes queued and running jobs. */
export const jobListRequestSchema = z.object({
	status: jobStatusSchema.or(z.literal("active")).optional(),
	type: z.string().min(1).optional(),
	limit: z.number().int().min(1).max(200).default(50),
	offset: z.number().int().min(0).default(0),
});
export type JobListRequest = z.infer<typeof jobListRequestSchema>;

export const jobListResponseSchema = z.object({
	items: z.array(jobDtoSchema),
	total: z.number().int().nonnegative(),
});
export type JobListResponse = z.infer<typeof jobListResponseSchema>;

export const jobIdRequestSchema = z.object({
	id: z.uuid(),
});
export const retryJobRequestSchema = jobIdRequestSchema.extend({
	replacementUploadId: z.uuid().optional(),
});
export type JobIdRequest = z.infer<typeof jobIdRequestSchema>;

/** Export format and whether image files should be included. */
export const sourceExportJobPayloadSchema = z.object({
	mode: z.enum(["ndjson", "tar"]),
	includeImages: z.boolean(),
});
export type SourceExportJobPayload = z.infer<
	typeof sourceExportJobPayloadSchema
>;

/** Restore format and server-side path to the input archive or dump. */
export const sourceRestoreJobPayloadSchema = z.object({
	mode: z.enum(["ndjson", "tar"]),
	inputPath: z.string().min(1),
});
export type SourceRestoreJobPayload = z.infer<
	typeof sourceRestoreJobPayloadSchema
>;

export const batchTargetsInputSchema = jobIdRequestSchema.extend({
	limit: z.number().int().min(1).max(200).default(25),
	offset: z.number().int().nonnegative().default(0),
});

export const importStageTypeSchema = z.enum([
	"downloadImage",
	"import_upload",
	"import_register",
	"processMedia",
	"auto_tagging",
	"extract_embedding_vector",
	"extract_ccip_vector",
]);

const importStageProgressSchema = jobProgressCountsSchema.extend({
	type: importStageTypeSchema,
	pending: z.number().int().nonnegative(),
	running: z.number().int().nonnegative(),
	cancelled: z.number().int().nonnegative(),
});

export const batchTargetsSchema = z.object({
	items: z.array(
		z.object({
			label: z.string(),
			mediaId: z.uuid().nullable(),
			mediaSourceId: z.uuid().nullable(),
			mediaModifiedAt: z.coerce.date().nullable(),
			status: jobStatusSchema.nullable(),
			skipped: z.boolean(),
			stage: z.string().nullable(),
			uploadReservationId: z.uuid().nullish(),
		}),
	),
	total: z.number().int().nonnegative(),
	stages: z
		.array(importStageProgressSchema)
		.optional()
		.describe(
			"Counts of scheduled work across the entire import batch, independent of target pagination.",
		),
});
export type BatchTargets = z.infer<typeof batchTargetsSchema>;
