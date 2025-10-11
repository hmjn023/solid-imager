/**
 * Sources Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 */

import { z } from "zod";

export const sourceIdSchema = z.string().uuid("Invalid source ID format");

export const localConnectionSchema = z.object({
	path: z.string().min(1, "Path is required"),
});
