/**
 * IPs Domain Validation Schemas
 * Extracted from src/lib/schemas.ts during architecture reorganization
 * Note: No IP-specific schemas found in original schemas.ts
 * This file serves as a placeholder for future IP domain schemas
 */

import { z } from "zod";

export const newIpSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateIpSchema = newIpSchema.partial();

export type NewIp = z.infer<typeof newIpSchema>;
export type UpdateIp = z.infer<typeof updateIpSchema>;
