/**
 * Media Sources API Client
 * Handles all API calls related to media sources
 */

import { z } from "zod";
import { mediaSourceInfoSchema } from "~/domain/sources/schemas";
import { apiBlobRequest, apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Schema for media source list response
 */
const mediaSourceListSchema = z.array(mediaSourceInfoSchema);

/**
 * Schema for restore response
 */
const restoreResponseSchema = z.object({
  processed: z.number(),
  skipped: z.number(),
});

/**
 * Fetches all media sources
 * @returns Array of media sources
 */
export function fetchMediaSources() {
  return apiRequest(API_ENDPOINTS.sources, mediaSourceListSchema);
}

/**
 * Creates a new media source
 * @param data - Media source data
 * @returns Created media source
 */
export function createMediaSource(data: unknown) {
  return apiRequest(API_ENDPOINTS.sources, mediaSourceInfoSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/**
 * Updates an existing media source
 * @param id - Media source ID
 * @param data - Updated media source data
 * @returns Updated media source
 */
export function updateMediaSource(id: string, data: unknown) {
  return apiRequest(API_ENDPOINTS.sourceDetail(id), mediaSourceInfoSchema, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/**
 * Deletes a media source
 * @param id - Media source ID
 */
export async function deleteMediaSource(id: string): Promise<void> {
  // DELETE requests typically don't return data, so we use a simple schema
  const voidSchema = z.unknown();
  await apiRequest(API_ENDPOINTS.sourceDetail(id), voidSchema, {
    method: "DELETE",
  });
}

/**
 * Fetches a dump of the media source
 * @param id - Media source ID
 * @param mode - The dump mode (json or zip)
 * @returns Blob containing the dump
 */
export function fetchSourceDump(
  id: string,
  mode: "json" | "zip" = "json"
): Promise<Blob> {
  const url = `${API_ENDPOINTS.sourceDump(id)}?mode=${mode}`;
  return apiBlobRequest(url, {
    method: "GET",
  });
}

/**
 * Restores a media source from a dump
 * @param id - Media source ID
 * @param data - The dump data to restore (JSON object)
 * @returns Restore result
 */
export function restoreSource(id: string, data: unknown) {
  return apiRequest(API_ENDPOINTS.sourceRestore(id), restoreResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
