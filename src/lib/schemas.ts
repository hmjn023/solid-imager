import { z } from "zod";

export const mediaTypeSchema = z.enum(["image", "video", "audio"]);

export const addMediaRequestSchema = z.object({
  sourceId: z.string().uuid("Invalid source ID format"),
  filePath: z.string().min(1, "File path is required"),
  fileName: z.string().min(1, "File name is required"),
  size: z.number().int().positive("File size must be a positive integer"),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  mediaType: mediaTypeSchema,
  width: z.number().int().positive("Width must be a positive integer"),
  height: z.number().int().positive("Height must be a positive integer"),
});

export const updateMediaRequestSchema = z.object({
  filePath: z.string().min(1, "File path cannot be empty").optional(),
  fileName: z.string().min(1, "File name cannot be empty").optional(),
  size: z
    .number()
    .int()
    .positive("File size must be a positive integer")
    .optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  mediaType: mediaTypeSchema.optional(),
  width: z
    .number()
    .int()
    .positive("Width must be a positive integer")
    .optional(),
  height: z
    .number()
    .int()
    .positive("Height must be a positive integer")
    .optional(),
  description: z.string().optional(),
  sourceUrl: z.string().url("Invalid URL format").optional(),
});

export const mediaIdSchema = z.string().uuid("Invalid media ID format");

export const sourceIdSchema = z.string().uuid("Invalid source ID format");

export const directoryPathSchema = z
  .string()
  .min(1, "Directory path is required");

export const localConnectionSchema = z.object({
  path: z.string().min(1, "Path is required"),
});
