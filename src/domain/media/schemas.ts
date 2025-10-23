/**
 * Media Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

/**
 * Schema for validating media types.
 */
export const mediaTypeSchema = z.enum(["image", "video", "audio"]);

/**
 * Schema for validating requests to add new media.
 */
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

/**
 * Schema for validating requests to update existing media.
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
 * Schema for validating media IDs.
 */
export const mediaIdSchema = z.string().uuid("Invalid media ID format");

/**
 * Schema for validating source IDs.
 */
export const sourceIdSchema = z.string().uuid("Invalid source ID format");

/**
 * Schema for validating directory paths.
 */
export const directoryPathSchema = z
  .string()
  .min(1, "Directory path is required");
