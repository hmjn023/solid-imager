/**
 * Media API Client
 * Handles all API calls related to media items
 *
 * NOTE: Migrated to use oRPC ✅
 */

import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { searchMedia } from "./search-api";

/**
 * Fetches media list for a specific source
 * @param sourceId - Media source ID
 * @returns Array of media items
 */
export async function fetchMediaList(sourceId: string) {
	const result = await orpc.media.search({
		sourceId,
		params: {
			offset: 0,
			limit: 100, // Reasonable default
		},
	});
	return result.media;
}

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
	limit = 50,
) {
	// Use search API for pagination support
	return searchMedia(sourceId, {
		offset: pageParam,
		limit,
		sort: "date",
		order: "desc",
	});
}

/**
 * Fetches detailed information for a specific media item
 * @param sourceId - Media source ID
 * @param mediaId - Media ID
 * @returns Media details including tags and generation info
 */
export function fetchMediaDetails(sourceId: string, mediaId: string) {
	return orpc.media.getDetails({ sourceId, mediaId });
}

/**
 * Uploads media to a specific source
 * @param sourceId - Media source ID
 * @param file - File to upload
 * @returns Upload response with media information
 */
export function uploadMedia(
	sourceId: string,
	file: File,
	options?: {
		filename?: string;
		description?: string;
		sourceUrl?: string;
		overwrite?: boolean;
		autoIncrement?: boolean;
	},
) {
	return orpc.media.upload({
		sourceId,
		file,
		filename: options?.filename,
		description: options?.description,
		sourceUrl: options?.sourceUrl,
		overwrite:
			options?.overwrite !== undefined ? String(options.overwrite) : undefined,
		autoIncrement:
			options?.autoIncrement !== undefined
				? String(options.autoIncrement)
				: undefined,
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
	updates: { description?: string; sourceUrl?: string },
) {
	return orpc.media.update({
		sourceId,
		mediaId,
		data: updates,
	});
}

/**
 * Deletes a media item
 * @param sourceId - Media source ID
 * @param mediaId - Media ID
 */
export function deleteMedia(sourceId: string, mediaId: string) {
	return orpc.media.delete({ sourceId, mediaId });
}

/**
 * Copies a media item to another source
 * @param sourceId - Current Media source ID (Legacy param, kept for signature compatibility)
 * @param mediaId - Media ID
 * @param targetSourceId - Target Media source ID
 */
export function copyMedia(
	_sourceId: string,
	mediaId: string,
	targetSourceId: string,
) {
	return orpc.media.copy({ mediaId, targetSourceId });
}

/**
 * Moves a media item to another source
 * @param sourceId - Current Media source ID (Legacy param, kept for signature compatibility)
 * @param mediaId - Media ID
 * @param targetSourceId - Target Media source ID
 */
export function moveMedia(
	_sourceId: string,
	mediaId: string,
	targetSourceId: string,
) {
	return orpc.media.move({ mediaId, targetSourceId });
}
