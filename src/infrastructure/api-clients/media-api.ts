/**
 * Media API Client
 * Handles all API calls related to media items
 */

import { z } from "zod";
import {
  mediaDetailsSchema,
  mediaSchema,
  uploadResponseSchema,
} from "~/domain/media/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Schema for media list response
 */
const mediaListSchema = z.array(mediaSchema);

/**
 * Fetches media list for a specific source
 * @param sourceId - Media source ID
 * @returns Array of media items
 */
export function fetchMediaList(sourceId: string) {
  return apiRequest(API_ENDPOINTS.mediaList(sourceId), mediaListSchema);
}

import { searchMedia } from "./search-api";

/**
 * Fetches media list with pagination for infinite scroll
 * @param sourceId - Media source ID
 * @param pageParam - Offset for pagination
 * @param limit - Number of items per page
 * @returns Search results with media array and total count
 */
export function fetchMediaListInfinite(
  sourceId: string,
  pageParam = 0,
  limit = 50
) {
  // Use search API for pagination support
  // Default sort by date desc is handled by backend if not specified,
  // but we can be explicit if needed.
  return searchMedia(sourceId, {
    offset: pageParam,
    limit,
    sort: "date",
    order: "desc",
    tagMode: "and", // Default
  });
}

/**
 * Fetches detailed information for a specific media item
 * @param sourceId - Media source ID
 * @param mediaId - Media ID
 * @returns Media details including tags and generation info
 */
export function fetchMediaDetails(sourceId: string, mediaId: string) {
  return apiRequest(
    API_ENDPOINTS.mediaDetails(sourceId, mediaId),
    mediaDetailsSchema
  );
}

/**
 * Uploads media to a specific source
 * @param sourceId - Media source ID
 * @param formData - FormData containing the file and metadata
 * @returns Upload response with media information
 */
export function uploadMedia(sourceId: string, formData: FormData) {
  return apiRequest(API_ENDPOINTS.mediaUpload(sourceId), uploadResponseSchema, {
    method: "POST",
    body: formData,
  });
}

/**
 * Updates media metadata
 * @param sourceId - Media source ID
 * @param mediaId - Media ID
 * @param updates - Partial media updates (e.g., description, sourceUrl)
 * @returns Updated media details
 */
export function updateMedia(
  sourceId: string,
  mediaId: string,
  updates: { description?: string; sourceUrl?: string }
) {
  return apiRequest(API_ENDPOINTS.mediaUpdate(sourceId, mediaId), mediaSchema, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
}
