/**
 * Sources Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

/**
 * Zod schema for validating a source ID.
 * Ensures the ID is a valid UUID format.
 */
export const sourceIdSchema = z.string().uuid("Invalid source ID format");

/**
 * Zod schema for validating local connection information for a media source.
 * @property {string} path - The file system path to the local media source.
 */
export const localConnectionSchema = z.object({
  path: z.string().min(1, "Path is required"),
});
