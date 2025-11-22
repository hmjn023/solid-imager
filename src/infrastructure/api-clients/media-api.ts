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
