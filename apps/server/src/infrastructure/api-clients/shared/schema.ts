import { z } from "zod";

/**
 * Standard API success response
 */
export const apiSuccessResponseSchema = <T extends z.ZodTypeAny>(
	dataSchema: T,
) =>
	z.object({
		success: z.literal(true),
		data: dataSchema.optional(),
		message: z.string().optional(),
	});

export type ApiSuccessResponse<T = unknown> = {
	success: true;
	data?: T;
	message?: string;
};

/**
 * Standard API error response
 */
export const apiErrorResponseSchema = z.object({
	success: z.literal(false),
	error: z.string(),
	message: z.string().optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

/**
 * Combined API response type
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.union([apiSuccessResponseSchema(dataSchema), apiErrorResponseSchema]);

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
