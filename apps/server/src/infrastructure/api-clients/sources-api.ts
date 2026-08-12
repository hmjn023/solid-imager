/**
 * Media Sources API Client
 * Handles all API calls related to media sources
 *
 * Source operations use oRPC, including binary export artifacts.
 */

import { downloadCompletedJobArtifact } from "@solid-imager/client";
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

export function enqueueSourceExport(
	id: string,
	mode: "json" | "zip" | "lancedb",
	includeImages: boolean,
) {
	return orpc.sources.enqueueExport({ id, mode, includeImages });
}

export function enqueueSourceImport(
	id: string,
	mode: "json" | "zip" | "lancedb",
	file: File,
) {
	return orpc.sources.enqueueImport({ id, mode, file });
}

/**
 * Fetches a dump of the media source
 * @param id - Media source ID
 * @param mode - The dump mode (ndjson, tar, or lancedb tar)
 * @returns Blob containing the dump
 */
export async function fetchSourceDump(
	id: string,
	mode: "json" | "zip" | "lancedb" = "json",
	opts?: { includeImages?: boolean },
): Promise<Blob> {
	const includeImages = opts?.includeImages ?? false;
	const job = await orpc.sources.enqueueExport({
		id,
		mode,
		includeImages,
	});
	return downloadCompletedJobArtifact(orpc.jobs, job.id);
}

export function restoreSource(id: string, data: unknown) {
	if (!Array.isArray(data)) {
		throw new Error("Invalid restore data: expected an array");
	}
	return orpc.sources.restore({ id, data });
}

/**
 * Imports a media source from a TAR file
 * @param id - Media source ID
 * @param file - The TAR file to import
 * @returns Import result
 */
export async function importSourceZip(id: string, file: File) {
	return orpc.sources.importZip({ id, file });
}

export async function importSourceNdjson(id: string, file: File) {
	return await orpc.sources.importNdjson({
		id,
		file,
	});
}

export async function importSourceLanceDB(id: string, file: File) {
	return orpc.sources.importLanceDB({ id, file });
}
