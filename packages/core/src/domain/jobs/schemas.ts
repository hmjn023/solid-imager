import { z } from "zod";

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
] as const;

/** Tests whether a job type represents a batch parent. */
export function isBatchParentJobType(type: string): boolean {
	return batchParentJobTypes.some((parentType) => parentType === type);
}

/** Batch counts, or null when progress is unavailable for the job. */
export const jobProgressSchema = z
	.object({
		processed: z.number().int().nonnegative(),
		failed: z.number().int().nonnegative(),
		total: z.number().int().nonnegative(),
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

/** Paginated job listing with an optional status filter. */
export const jobListRequestSchema = z.object({
	status: jobStatusSchema.optional(),
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
