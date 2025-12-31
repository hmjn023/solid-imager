/**
 * AI API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import type { z } from "zod";
import type { tagImageRequestSchema } from "~/domain/tagging/schemas";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

/**
 * Fetches AI tags for a media item
 * @param params - The parameters for the AI tagging request
 * @returns The tagging response containing general tags, characters, and IPs
 */
export function fetchAiTags(params: z.infer<typeof tagImageRequestSchema>) {
  return orpc.utils.aiTag(params);
}

/**
 * Fetches AI tags for a file upload
 * @param file - The file to tag
 */
export function fetchAiTagsForFile(file: File) {
  return orpc.utils.aiTag({ file });
}
