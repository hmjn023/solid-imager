/**
 * Media Sources API Client
 * Handles all API calls related to media sources
 *
 * NOTE: This file is being migrated to use oRPC.
 * - list, get, create, update, delete: Migrated to oRPC ✅
 * - dump, restore, import: Still using REST API (will migrate later)
 */

import { z } from "zod";
import { mediaSourceInfoSchema } from "~/domain/sources/schemas";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { apiBlobRequest, apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Schema for media source list response
 */
const _mediaSourceListSchema = z.array(mediaSourceInfoSchema);

/**
 * Schema for restore response
 */
const restoreResponseSchema = z.object({
  processed: z.number(),
  skipped: z.number(),
});

/**
 * Schema for import response
 */
const importResponseSchema = z.object({
  success: z.boolean(),
  importedCount: z.number(),
  message: z.string().optional(),
});

/**
 * Fetches all media sources
 * @returns Array of media sources
 */
export function fetchMediaSources() {
  return orpc.sources.list();
}

/**
 * Fetches a single media source by ID
 * @param id - Media source ID
 * @returns Media source
 */
export function fetchMediaSource(id: string) {
  return orpc.sources.get({ id });
}

/**
 * Creates a new media source
 * @param data - Media source data
 * @returns Created media source
 */
export function createMediaSource(data: unknown) {
  return orpc.sources.create(data as z.infer<typeof mediaSourceInfoSchema>);
}

/**
 * Updates an existing media source
 * @param id - Media source ID
 * @param data - Updated media source data
 * @returns Updated media source
 */
export function updateMediaSource(id: string, data: unknown) {
  return orpc.sources.update({
    id,
    data: data as Partial<z.infer<typeof mediaSourceInfoSchema>>,
  });
}

/**
 * Deletes a media source
 * @param id - Media source ID
 */
export async function deleteMediaSource(id: string): Promise<void> {
  await orpc.sources.delete({ id });
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

/**
 * Imports a media source from a ZIP file
 * @param id - Media source ID
 * @param file - The ZIP file to import
 * @returns Import result
 */
export function importSourceZip(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest(API_ENDPOINTS.sourceImport(id), importResponseSchema, {
    method: "POST",
    body: formData,
  });
}
