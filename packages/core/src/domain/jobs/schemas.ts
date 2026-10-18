import { z } from "zod";
import { processingStepDtoSchema } from "./processing";
export * from "./processing";
export * from "./retirement";

export const jobStatusSchema = z.enum([
	"pending",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const batchParentJobTypes = [
	"batch_ccip_parent",
	"bulk_tagging_parent",
	"thumbnail_generation_parent",
] as const;

export function isBatchParentJobType(type: string): boolean {
	return batchParentJobTypes.some((parentType) => parentType === type);
}

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
	canRetry: z.boolean().optional(),
	canCancel: z.boolean().optional(),
	canDelete: z.boolean().optional(),
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
	processingSteps: z.array(processingStepDtoSchema).optional(),
	currentProcessingSteps: z.array(processingStepDtoSchema).optional(),
	artifact: z
		.object({
			fileName: z.string(),
			contentType: z.string(),
			size: z.number().int().nonnegative().nullable(),
		})
		.nullable(),
});
export type JobDto = z.infer<typeof jobDtoSchema>;

export const jobListRequestSchema = z.object({
	status: z.union([jobStatusSchema, z.literal("active")]).optional(),
	limit: z.number().int().min(1).max(200).default(50),
	offset: z.number().int().min(0).default(0),
});
export type JobListRequest = z.infer<typeof jobListRequestSchema>;

export const jobListResponseSchema = z.object({
	items: z.array(jobDtoSchema),
	total: z.number().int().nonnegative(),
});
export type JobListResponse = z.infer<typeof jobListResponseSchema>;

export const jobRetryFailedCursorSchema = z.object({
	// Opaque DB timestamp without time zone; preserve its representation across clients.
	before: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/),
	afterId: z.uuid(),
});
export const jobRetryFailedRequestSchema = z.object({
	cursor: jobRetryFailedCursorSchema.optional(),
});
export const jobRetryFailedResponseSchema = z.object({
	retried: z.number().int().nonnegative(),
	skipped: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	cursor: jobRetryFailedCursorSchema.nullable(),
});
export type JobRetryFailedRequest = z.infer<typeof jobRetryFailedRequestSchema>;
export type JobRetryFailedResponse = z.infer<
	typeof jobRetryFailedResponseSchema
>;

export const jobIdRequestSchema = z.object({
	id: z.uuid(),
});
export type JobIdRequest = z.infer<typeof jobIdRequestSchema>;

export const sourceExportJobPayloadSchema = z.object({
	mode: z.enum(["ndjson", "tar"]),
	includeImages: z.boolean(),
});
export type SourceExportJobPayload = z.infer<
	typeof sourceExportJobPayloadSchema
>;

export const sourceRestoreJobPayloadSchema = z.object({
	mode: z.enum(["ndjson", "tar"]),
	inputPath: z.string().min(1),
});
export type SourceRestoreJobPayload = z.infer<
	typeof sourceRestoreJobPayloadSchema
>;
export {
	downloadRegistrationCheckpointSchema,
	downloadRegistrationEntrySchema,
	type DownloadRegistrationEntry,
} from "./download-registration";
