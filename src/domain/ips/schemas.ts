/**
 * IPs Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No IP-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future IP domain schemas
 */

import { z } from "zod";

export const ipDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
export type IpData = z.infer<typeof ipDataSchema>;
