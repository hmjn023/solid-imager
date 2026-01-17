import { z } from "zod";

/**
 * Schema for an individual item being imported.
 * Compatible with the structure used in BackupService but optimized for pre-download state.
 */
export const importItemSchema = z.object({
  /** The direct URL of the media (image/video) */
  imageUrl: z.string().url("Invalid image URL"),
  /** The origin URL (e.g., Tweet URL) */
  sourceUrl: z.string().url("Invalid source URL").optional(),
  /** User-provided or scraped description */
  description: z.string().optional(),
  /** ISO timestamp string or Date */
  timestamp: z.union([z.string(), z.date()]).optional(),
  /** Author information */
  author: z
    .object({
      name: z.string(),
      accountId: z.string().optional().nullable(),
    })
    .optional(),
  /** Tags associated with the media */
  tags: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["positive", "negative"]).default("positive"),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .optional(),
  /** Browser context for downloading restricted content */
  cookies: z.array(z.any()).optional(),
  userAgent: z.string().optional(),
});

export type ImportItem = z.infer<typeof importItemSchema>;

/**
 * Schema for bulk import requests.
 */
export const bulkImportRequestSchema = z.object({
  mediaSourceId: z.string().uuid("Invalid media source ID").optional(),
  items: z.array(importItemSchema).min(1, "At least one item is required"),
});

export type BulkImportRequest = z.infer<typeof bulkImportRequestSchema>;
