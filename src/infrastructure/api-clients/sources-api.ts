/**
 * Media Sources API Client
 * Handles all API calls related to media sources
 *
 * NOTE: This file is migrated to use oRPC ✅
 */

import type { z } from "zod";
import type { mediaSourceInfoSchema } from "~/domain/sources/schemas";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { apiBlobRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

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
export function createMediaSource(data: z.infer<typeof mediaSourceInfoSchema>) {
  return orpc.sources.create(data);
}

/**
 * Updates an existing media source
 * @param id - Media source ID
 * @param data - Updated media source data
 * @returns Updated media source
 */
export function updateMediaSource(
  id: string,
  data: Partial<z.infer<typeof mediaSourceInfoSchema>>
) {
  return orpc.sources.update({
    id,
    data,
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
  return orpc.sources.restore({ id, data });
}

/**
 * Imports a media source from a ZIP file
 * @param id - Media source ID
 * @param file - The ZIP file to import
 * @returns Import result
 */
export function importSourceZip(id: string, file: File) {
  return orpc.sources.importZip({ id, file });
}
