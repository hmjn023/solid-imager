/**
 * Media Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

/**
 * Zod schema for validating media types.
 * Allowed values are "image", "video", and "audio".
 */
export const mediaTypeSchema = z.enum(["image", "video", "audio"]);

/**
 * Zod schema for validating the request body when adding new media.
 * Ensures all required fields for new media are present and correctly formatted.
 */
export const addMediaRequestSchema = z.object({
  sourceId: z.string().uuid("Invalid source ID format"),
  filePath: z.string().min(1, "File path is required"),
  fileName: z.string().min(1, "File name is required"),
  size: z.number().int().positive("File size must be a positive integer"),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  mediaType: mediaTypeSchema,
  description: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  width: z.number().int().positive("Width must be a positive integer"),
  height: z.number().int().positive("Height must be a positive integer"),
});

/**
 * Zod schema for validating the request body when updating existing media.
 * All fields are optional, allowing partial updates.
 */
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

/**
 * Zod schema for validating a media ID.
 * Ensures the ID is a valid UUID format.
 */
export const mediaIdSchema = z.string().uuid("Invalid media ID format");

/**
 * Zod schema for validating a source ID.
 * Ensures the ID is a valid UUID format.
 */
export const sourceIdSchema = z.string().uuid("Invalid source ID format");

/**
 * Zod schema for validating a directory path.
 * Ensures the path is a non-empty string.
 */
export const directoryPathSchema = z
  .string()
  .min(1, "Directory path is required");

export const uploadRequestSchema = z.object({
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

export const conflictSchema = z.object({
  existingFile: z.string(),
  suggestedName: z.string(),
});

export const uploadResponseSchema = z.object({
  success: z.boolean(),
  filePath: z.string(),
  conflict: conflictSchema.optional(),
});
