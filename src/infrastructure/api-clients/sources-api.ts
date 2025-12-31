/**
 * Media Sources API Client
 * Handles all API calls related to media sources
 *
 * NOTE: This file is migrated to use oRPC ✅
 */

import type { z } from "zod";
import type { mediaSourceInfoSchema } from "~/domain/sources/schemas";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

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
    // For JSON, we can use the typed client directly
    const result = await orpc.sources.dump({ id, mode });
    // result is already the dump object
    return new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
  }

  // For ZIP, we need to handle the blob response which oRPC client might try to parse as JSON
  // So we stick to fetch, BUT we must match the oRPC wire format: { "json": { ...args... } }
  // or pure JSON if using a different Content-Type, but standard oRPC over HTTP usually expects wrapped args or standard JSON body.
  // Based on the error "expected object, received undefined", the server likely didn't see the args.

  // The RPC handler usually expects the input in the body directly for POST if it's not a GET.
  // Let's try sending the object directly first, but properly.
  // Actually, previously it failed with `{"id":..., "mode":...}`.
  // The error `{"issues":[{"expected":"object","code":"invalid_type","path":[],"message":"Invalid input: expected object, received undefined"}]}`
  // suggests that the root input was undefined.

  // In many RPC adapters (like tRPC/oRPC), the structure might be `{ input: ... }` or `{ json: ... }`.
  // Looking at the error response `{"json":{"defined":false,...` it seems to be parsing "json" field?
  // Let's try wrapping in `json` key assuming superjson/similar orpc default.

  const url = "/api/rpc/sources/dump";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Accept header is important
    },
    // Wrap arguments in "json" key if using superjson/standard serializer usually
    // BUT wait, `orpc` might just expect the raw JSON if not using special serializers.
    // Let's look at `sources-router.ts`. It uses `z.object({...})`.
    // The previous error implies it received `undefined` when expecting an object.
    // This often happens if the body is not parsed correctly or the structure is wrong.

    // Attempt 1: Try wrapping in `json` as per standard orpc-over-http often seen
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
