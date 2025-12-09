/**
 * AI API Client
 * Handles AI-related operations
 */

import type { z } from "zod";
import {
  type tagImageRequestSchema,
  taggingResponseSchema,
} from "~/domain/tagging/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Fetches AI tags for a media item
 * @param params - The parameters for the AI tagging request
 * @returns The tagging response containing general tags, characters, and IPs
 */
export function fetchAiTags(params: z.infer<typeof tagImageRequestSchema>) {
  return apiRequest(API_ENDPOINTS.aiTag, taggingResponseSchema, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}
