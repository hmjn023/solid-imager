/**
 * Media Sources API Client
 * Handles all API calls related to media sources
 *
 * NOTE: All operations use oRPC. dump (zip mode) uses a dedicated file route
 * because oRPC's RPC transport cannot handle binary ReadableStream responses.
 */

import type { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import type { z } from "zod";
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
	data: Partial<z.infer<typeof mediaSourceInfoSchema>>,
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
 * Syncs one or more media sources
 * @param ids - Array of media source IDs to sync
 * @returns Sync results
 */
export function syncMediaSources(ids: string[]) {
	return orpc.sources.sync({ ids });
}

/**
 * Fetches a dump of the media source
 * @param id - Media source ID
 * @param mode - The dump mode (json or zip)
 * @returns Blob containing the dump
 */
export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" = "json",
): Promise<Blob> {
	if (mode === "zip") {
		// ZIP mode returns a binary ReadableStream — oRPC RPC transport cannot handle
		// this, so use the dedicated file route instead.
		const url = `/api/sources/${id}/dump?mode=zip`;
		const response = await fetch(url, { method: "GET" });
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Failed to download dump: ${response.status} ${errorText}`,
			);
		}
		return response.blob();
	}
	const result = await orpc.sources.dump({ id, mode: "json" });
	return new Blob([JSON.stringify(result)], { type: "application/json" });
}

export function restoreSource(id: string, data: any) {
	return orpc.sources.restore({ id, data });
}

/**
 * Imports a media source from a ZIP file
 * @param id - Media source ID
 * @param file - The ZIP file to import
 * @returns Import result
 */
export async function importSourceZip(id: string, file: File) {
	return orpc.sources.importZip({ id, file });
}
