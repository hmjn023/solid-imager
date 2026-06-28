/**
 * AI API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import type { tagImageRequestSchema } from "@solid-imager/core/domain/tagging/schemas";
import type { z } from "zod";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

/**
 * Fetches AI tags for a media item
 * @param params - The parameters for the AI tagging request
 * @returns The tagging response containing general tags, characters, and IPs
 */
export function fetchAiTags(params: z.infer<typeof tagImageRequestSchema>) {
	return orpc.ai.tag(params);
}

/**
 * Fetches AI tags for a file upload
 * @param file - The file to tag
 */
export function fetchAiTagsForFile(file: File) {
	return orpc.ai.tag({ file });
}

export function fetchCharacterCrops(mediaId: string, transparent: boolean) {
	return orpc.ai.detectAndCropCharacters({ mediaId, transparent });
}

export function scanBatchTaggingTargets(params: {
	force?: boolean;
	mediaSourceId?: string;
}) {
	return orpc.ai.scanBatchTaggingTargets(params);
}

export function startBatchTaggingWithIds(params: {
	force?: boolean;
	mediaSourceId?: string;
	mediaIds: string[];
}) {
	return orpc.ai.startBatchTaggingWithIds(params);
}

export function getCcipVectorStatus(mediaSourceId: string, mediaId: string) {
	return orpc.ai.ccipVectorStatus({ mediaSourceId, mediaId });
}

export function startCcipExtraction(
	mediaSourceId: string,
	mediaId: string,
	force = false,
) {
	return orpc.ai.startCcipExtraction({ mediaSourceId, mediaId, force });
}

export function scanBatchCcipTargets(params: {
	force?: boolean;
	mediaSourceId?: string;
}) {
	return orpc.ai.scanBatchCcipTargets(params);
}

export function startBatchCcipExtraction(params: {
	force?: boolean;
	mediaSourceId?: string;
	mediaIds: string[];
}) {
	return orpc.ai.startBatchCcipExtraction(params);
}
