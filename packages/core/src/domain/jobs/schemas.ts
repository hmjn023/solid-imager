import { z } from "zod";

export const jobStatusSchema = z.enum([
	"pending",
	"in_progress",
	"completed",
	"failed",
	"cancelled",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

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
	id: z.string().uuid(),
	type: z.string(),
	mediaSourceId: z.string().uuid().nullable(),
	status: jobStatusSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	parentId: z.string().uuid().nullable(),
	error: z.string().nullable(),
	cancelRequestedAt: z.coerce.date().nullable(),
	cancelledAt: z.coerce.date().nullable(),
	attemptCount: z.number().int().nonnegative(),
	startedAt: z.coerce.date().nullable(),
	finishedAt: z.coerce.date().nullable(),
	targetMediaId: z.string().uuid().nullable(),
	progress: jobProgressSchema,
	artifact: z
		.object({
			fileName: z.string(),
			contentType: z.string(),
			size: z.number().int().nonnegative().nullable(),
			downloadUrl: z.string().min(1),
		})
		.nullable(),
});
export type JobDto = z.infer<typeof jobDtoSchema>;

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
	id: z.string().uuid(),
});
export type JobIdRequest = z.infer<typeof jobIdRequestSchema>;

export const sourceExportJobPayloadSchema = z.object({
	mode: z.enum(["json", "zip", "lancedb"]),
	includeImages: z.boolean(),
});
export type SourceExportJobPayload = z.infer<
	typeof sourceExportJobPayloadSchema
>;

export const sourceRestoreJobPayloadSchema = z.object({
	mode: z.enum(["json", "zip", "lancedb"]),
	inputPath: z.string().min(1),
});
export type SourceRestoreJobPayload = z.infer<
	typeof sourceRestoreJobPayloadSchema
>;
