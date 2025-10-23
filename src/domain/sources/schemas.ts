/**
 * Sources Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

/**
 * Schema for validating source IDs.
 */
export const sourceIdSchema = z.string().uuid("Invalid source ID format");

/**
 * Schema for validating local connection information.
 */
export const localConnectionSchema = z.object({
  /**
   * The file path for the local connection.
   */
  path: z.string().min(1, "Path is required"),
});
