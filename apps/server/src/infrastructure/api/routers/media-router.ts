import { implement, ORPCError } from "@orpc/server";
import { mediaContract } from "@solid-imager/core/domain/contract/media.contract";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import { asyncPool } from "@solid-imager/core/utils/async-pool";
import { logger } from "~/infrastructure/logger";
import { BulkOperationService } from "~/infrastructure/services/bulk-operation-service";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";
import { MediaService } from "~/infrastructure/services/media-service";

/**
 * Media Router Implementation
 */
const os = implement(mediaContract);

export const mediaRouter = os.router({
	/**
	 * Search media in a source
	 */
	search: os.search.handler(
		async ({ input }) =>
			await MediaService.searchMedia(input.sourceId, input.params),
	),

	searchSimilar: os.searchSimilar.handler(async ({ input }) => {
		const startedAt = Date.now();
		logger.info(
			{
				anchorMediaId: input.anchorMediaId,
				mediaSourceId: input.mediaSourceId,
				topK: input.topK,
			},
			"Vector similarity search started",
		);
		try {
			const result = await ccipVectorService.searchSimilar(
				input.anchorMediaId,
				input.topK,
				input.mediaSourceId,
			);
			logger.info(
				{
					anchorMediaId: input.anchorMediaId,
					mediaSourceId: input.mediaSourceId,
					topK: input.topK,
					resultCount: result.media.length,
					durationMs: Date.now() - startedAt,
				},
				"Vector similarity search completed",
			);
			return result;
		} catch (error) {
			logger.error(
				{
					err: error,
					anchorMediaId: input.anchorMediaId,
					mediaSourceId: input.mediaSourceId,
					topK: input.topK,
					durationMs: Date.now() - startedAt,
				},
				"Vector similarity search failed",
			);
			throw error;
		}
	}),

	/**
	 * Get a specific media file
	 */
	get: os.get.handler(async ({ input }) => {
		const media = await MediaService.getMedia(input.sourceId, input.mediaId);
		if (!media) {
			throw new ResourceNotFoundError("Media", input.mediaId);
		}
		return media;
	}),

	/**
	 * Get media details (with tags, category, IP, characters, etc.)
	 */
	getDetails: os.getDetails.handler(
		async ({ input }) =>
			await MediaService.getMediaDetails(input.sourceId, input.mediaId),
	),

	/**
	 * Find duplicate media by filename pattern and source URL matching
	 */
	findDuplicates: os.findDuplicates.handler(
		async ({ input }) => await MediaService.findDuplicates(input ?? {}),
	),

	/**
	 * Get media file content (binary)
	 * Note: This returns the actual image/video file
	 */
	getContent: os.getContent.handler(() => {
		// JSONシリアライズを避けるため、バッファコンテンツではなくURLまたはストリームを返す必要があります
		// 現時点では、誤用を防ぐためにバッファの返却を削除するか、エラーをスローするのが安全です。
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Binary content cannot be returned via oRPC. Please use the dedicated REST endpoint. Refer to the API documentation for details.",
		});
	}),

	/**
	 * Get tags for a media file
	 */
	getTags: os.getTags.handler(
		async ({ input }) =>
			await MediaService.getMediaTags(input.sourceId, input.mediaId),
	),

	/**
	 * Update media metadata
	 */
	update: os.update.handler(
		async ({ input }) =>
			await MediaService.updateMedia(input.sourceId, input.mediaId, input.data),
	),

	/**
	 * Sync (reprocess) multiple media items
	 */
	sync: os.sync.handler(async ({ input }) => {
		const results: { id: string; success: boolean; error?: string }[] = [];

		async function processMedia(mediaId: string) {
			await MediaService.reprocessMetadata(input.sourceId, mediaId);
		}

		const poolResults = await asyncPool(input.mediaIds, 5, processMedia);

		for (const [index, pr] of poolResults.entries()) {
			const mediaId = input.mediaIds[index];
			if (pr.status === "fulfilled") {
				results.push({ id: mediaId, success: true });
			} else {
				results.push({
					id: mediaId,
					success: false,
					error: String(pr.reason),
				});
			}
		}

		return { results };
	}),

	/**
	 * Delete a media file
	 */
	delete: os.delete.handler(async ({ input }) => {
		await MediaService.deleteMedia(input.sourceId, input.mediaId);
		try {
			await ccipVectorService.delete(input.mediaId);
		} catch (err) {
			logger.warn(
				{ err, mediaId: input.mediaId },
				"[MediaRouter] Vector delete failed after media delete",
			);
		}
		return { success: true };
	}),

	/**
	 * Copy a media item to another source
	 */
	copy: os.copy.handler(
		async ({ input }) =>
			await MediaService.copyMedia(input.mediaId, input.targetSourceId),
	),

	/**
	 * Move a media item to another source
	 */
	move: os.move.handler(async ({ input }) => {
		const result = await MediaService.moveMedia(
			input.mediaId,
			input.targetSourceId,
		);
		try {
			await ccipVectorService.delete(input.mediaId);
		} catch (err) {
			logger.warn(
				{ err, mediaId: input.mediaId },
				"[MediaRouter] Vector delete failed after media move",
			);
		}
		return result;
	}),

	/**
	 * Upload media to a source
	 */
	/**
	 * Upload media to a source
	 */
	upload: os.upload.handler(
		async ({ input }) =>
			await MediaService.uploadMedia(input.sourceId, input.file, {
				filename: input.filename,
				description: input.description,
				sourceUrl: input.sourceUrl,
				overwrite: input.overwrite === "true",
				autoIncrement: input.autoIncrement === "true",
			}),
	),

	/**
	 * Bulk edit multiple media metadata
	 */
	bulkEdit: os.bulkEdit.handler(async ({ input }) => {
		await BulkOperationService.bulkEditMedia(
			input.mediaSourceId,
			input.mediaIds,
			input.updates,
		);
		return { success: true };
	}),

	/**
	 * Bulk delete multiple media items
	 */
	bulkDelete: os.bulkDelete.handler(async ({ input }) => {
		await BulkOperationService.bulkDeleteMedia(
			input.mediaSourceId,
			input.mediaIds,
		);
		await Promise.allSettled(
			input.mediaIds.map(async (mediaId) => {
				try {
					await ccipVectorService.delete(mediaId);
				} catch (err) {
					logger.warn(
						{ err, mediaId },
						"[MediaRouter] Vector delete failed after bulk media delete",
					);
				}
			}),
		);
		return { success: true };
	}),

	/**
	 * Bulk move multiple media items within the source
	 */
	bulkMove: os.bulkMove.handler(async ({ input }) => {
		await BulkOperationService.bulkMoveMedia(
			input.mediaSourceId,
			input.mediaIds,
			input.destinationPath,
		);
		return { success: true };
	}),

	/**
	 * Bulk add/remove tags on multiple media items
	 */
	bulkTag: os.bulkTag.handler(async ({ input }) => {
		await BulkOperationService.bulkTagMedia(
			input.mediaSourceId,
			input.mediaIds,
			input.tagsToAdd,
			input.tagsToRemove,
		);
		return { success: true };
	}),

	/**
	 * Bulk copy multiple media items to another source
	 */
	bulkCopyToSource: os.bulkCopyToSource.handler(async ({ input }) => {
		await BulkOperationService.bulkCopyToSource(
			input.mediaSourceId,
			input.mediaIds,
			input.targetSourceId,
		);
		return { success: true };
	}),

	/**
	 * Bulk move multiple media items to another source
	 */
	bulkMoveToSource: os.bulkMoveToSource.handler(async ({ input }) => {
		await BulkOperationService.bulkMoveToSource(
			input.mediaSourceId,
			input.mediaIds,
			input.targetSourceId,
		);
		return { success: true };
	}),
});
