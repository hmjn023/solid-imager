/**
 * Search API Client
 * Handles media search functionality
 */

import type { MediaSearchRequest } from "~/domain/media/schemas";
import { mediaSearchResponseSchema } from "~/domain/media/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Searches media in a specific source
 * @param sourceId - Media source ID
 * @param params - Search parameters
 * @returns Search results with media array and total count
 */
export function searchMedia(sourceId: string, params: MediaSearchRequest) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (params.tags) {
    searchParams.set("tags", params.tags);
  }
  if (params.excludeTags) {
    searchParams.set("excludeTags", params.excludeTags);
  }
  if (params.projects) {
    searchParams.set("projects", params.projects);
  }
  if (params.ips) {
    searchParams.set("ips", params.ips);
  }
  if (params.characters) {
    searchParams.set("characters", params.characters);
  }
  searchParams.set("tagMode", params.tagMode);
  if (params.sort) {
    searchParams.set("sort", params.sort);
  }
  searchParams.set("order", params.order);
  if (params.limit !== undefined) {
    searchParams.set("limit", params.limit.toString());
  }
  searchParams.set("offset", params.offset.toString());

  const url = `${API_ENDPOINTS.mediaSearch(sourceId)}?${searchParams}`;
  return apiRequest(url, mediaSearchResponseSchema);
}
