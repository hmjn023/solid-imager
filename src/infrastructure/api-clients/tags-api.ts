/**
 * Tags API Client
 * Handles all API calls related to tags
 */

import { tagListResponseSchema } from "~/domain/tags/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Fetches all available tags
 * @returns Array of tags
 */
export function fetchTags() {
  return apiRequest(API_ENDPOINTS.tags, tagListResponseSchema);
}
