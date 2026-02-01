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
  source: z.string().optional(),
});

export const updateIpSchema = newIpSchema.partial();

export type NewIp = z.infer<typeof newIpSchema>;
export type UpdateIp = z.infer<typeof updateIpSchema>;

export const ipSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  source: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Ip = z.infer<typeof ipSchema>;
