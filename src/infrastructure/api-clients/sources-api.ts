/**
 * Media Sources API Client
 * Handles all API calls related to media sources
 *
 * NOTE: This file is migrated to use oRPC ✅
 */

import type { z } from "zod";
import type { mediaSourceInfoSchema } from "~/domain/sources/schemas";
import { getBaseUrl, orpc } from "~/infrastructure/api-clients/orpc-client";

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
export async function fetchSourceDump(
  id: string,
  mode: "json" | "zip" = "json"
): Promise<Blob> {
  if (mode === "json") {
    const result = await orpc.sources.dump({ id, mode });
    return new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
  }

  // For ZIP, fetch directly matching the oRPC wire format
  const url = `${getBaseUrl()}/sources/dump`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      json: { id, mode },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download dump: ${response.status} ${errorText}`);
  }

  return response.blob();
}

// biome-ignore lint/suspicious/noExplicitAny: complex dump structure
export function restoreSource(id: string, data: any) {
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
