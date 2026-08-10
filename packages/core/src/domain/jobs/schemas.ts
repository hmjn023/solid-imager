import { z } from "zod";

export const jobStatusSchema = z.enum([
	"pending",
	"in_progress",
	"completed",
	"failed",
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
	targetMediaId: z.string().uuid().nullable(),
	progress: jobProgressSchema,
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
