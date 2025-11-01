import { z } from "zod";

export const conflictSchema = z.object({
  existingFile: z.string(),
  suggestedName: z.string(),
});
export type Conflict = z.infer<typeof conflictSchema>;

export const uploadMediaRequestSchema = z.object({
  filename: z.string().optional(),
  autoIncrement: z
    .preprocess((val) => String(val).toLowerCase() === "true", z.boolean())
    .optional(),
  description: z.string().optional(),
  sourceUrl: z.string().url("Invalid URL format").optional(),
  overwrite: z
    .preprocess((val) => String(val).toLowerCase() === "true", z.boolean())
    .optional(),
});
export type UploadMediaRequest = z.infer<typeof uploadMediaRequestSchema>;

export const uploadResponseSchema = z.object({
  success: z.boolean(),
  filePath: z.string(),
  conflict: conflictSchema.optional(),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
