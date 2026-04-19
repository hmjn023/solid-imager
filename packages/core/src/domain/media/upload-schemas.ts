import { z } from "zod";

export const conflictSchema = z.object({
	existingFile: z.string(),
	suggestedName: z.string(),
});
export type Conflict = z.infer<typeof conflictSchema>;

// Base schema definition for shared fields
const baseUploadFields = {
	description: z.string().optional(),
	// Allow valid URL or empty string (which acts as "no URL")
	sourceUrl: z.string().url("Invalid URL format").or(z.literal("")).optional(),
};

// Schema for Frontend UI Form
// Schema for Frontend UI Form
export const uploadMediaFormSchema = z.object({
	description: z.string(),
	// Allow valid URL or empty string (which acts as "no URL")
	sourceUrl: z.string().url("Invalid URL format").or(z.literal("")),
	filename: z.string().min(1, "Filename is required"),
	overwrite: z.boolean(),
	autoIncrement: z.boolean(),
});
export type UploadMediaFormData = z.infer<typeof uploadMediaFormSchema>;

// Schema for Backend API Request (FormData parsing)
export const uploadMediaRequestSchema = z.object({
	...baseUploadFields,
	filename: z.string().optional(),
	autoIncrement: z
		.preprocess((val) => String(val).toLowerCase() === "true", z.boolean())
		.optional(),
	overwrite: z.preprocess((val) => String(val).toLowerCase() === "true", z.boolean()).optional(),
});
export type UploadMediaRequest = z.infer<typeof uploadMediaRequestSchema>;

export const uploadResponseSchema = z.object({
	success: z.boolean(),
	filePath: z.string(),
	conflict: conflictSchema.optional(),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
