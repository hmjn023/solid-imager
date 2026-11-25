import { reserveImportFiles } from "~/infrastructure/services/import-submission";
import {
	isUploadBatchCancelled,
	submitBatchUpload,
} from "~/infrastructure/services/import-submission-retry";
import { implement, ORPCError } from "@orpc/server";
import { mediaContract } from "@solid-imager/core/contract";
import type { ResponseHeadersHandlerPluginContext } from "@orpc/server/plugins";
import type { MediaPreferencesPatch } from "@solid-imager/core/media";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/errors";
import { asyncPool } from "@solid-imager/core/utils";
import { services } from "~/infrastructure/service-registry";
import { logger } from "~/infrastructure/logger";
import { createMediaFileResponse } from "~/infrastructure/http/media-file-response";
import { BulkOperationService } from "~/infrastructure/services/bulk-operation-service";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";
import { MediaService } from "~/infrastructure/services/media-service";
import { getEmbeddingSearchService } from "~/infrastructure/services/embedding-search-service";
import { getRelatedMediaService } from "~/infrastructure/services/related-media-service";
import {
	readMediaThumbnail,
	readOriginalMediaFile,
} from "~/infrastructure/services/media-files";

/**
 * Media Router Implementation
 */
const os =
	implement(mediaContract).$context<ResponseHeadersHandlerPluginContext>();

async function mediaFileResponse(
	location: { sourceId: string; mediaId: string },
	request: Pick<Request, "method" | "headers">,
) {
	const media = await readOriginalMediaFile(
		location.sourceId,
		location.mediaId,
	);
	if (media.error) {
		throw new ORPCError(media.error, { message: media.message });
	}
	return createMediaFileResponse(request, media.file, media.contentType);
}

async function updateActivity(
	sourceId: string,
	mediaId: string,
	change: MediaPreferencesPatch | { viewId: string },
) {
	try {
		return await services
			.getMediaRepository()
			.updateActivity(sourceId, mediaId, change);
	} catch (error) {
		if (error instanceof ResourceNotFoundError)
			throw new ORPCError("NOT_FOUND", { message: error.message });
		if (error instanceof ResourceConflictError)
			throw new ORPCError("CONFLICT", { message: error.message });
		throw error;
	}
}

export const mediaRouter = os.router({
	getRelated: os.getRelated.handler(async ({ input }) => {
		try {
			return await getRelatedMediaService().getRelated(input);
		} catch (error) {
			if (error instanceof ResourceNotFoundError) {
				throw new ORPCError("NOT_FOUND", { message: error.message });
			}
			throw error;
		}
	}),
	statistics: os.statistics.handler(({ input }) =>
		services.getMediaRepository().getStatistics(input),
	),
	updatePreferences: os.updatePreferences.handler(({ input }) =>
		updateActivity(input.sourceId, input.mediaId, input.data),
	),
	recordView: os.recordView.handler(({ input }) =>
		updateActivity(input.sourceId, input.mediaId, { viewId: input.viewId }),
	),
	searchSemantic: os.searchSemantic.handler(({ input }) =>
		getEmbeddingSearchService().searchText(input),
	),
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
			const service =
				input.model === "embeddinggemma2"
					? getEmbeddingSearchService()
					: ccipVectorService;
			const result = await service.searchSimilar(
				input.anchorMediaId,
				input.topK,
				input.mediaSourceId,
				input.limit,
				input.offset,
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

	getContent: os.getContent.handler(async ({ input, context, errors }) => {
		const headers = new Headers();
		if (input.headers?.range) headers.set("range", input.headers.range);
		if (input.headers?.["if-range"] !== undefined) {
			headers.set("if-range", input.headers["if-range"]);
		}
		const response = await mediaFileResponse(input.params, {
			method: "GET",
			headers,
		});
		const { status, body } = response;
		if (status === 416) {
			for (const name of ["content-range", "accept-ranges", "cache-control"]) {
				const value = response.headers.get(name);
				if (value !== null) context.resHeaders?.set(name, value);
			}
			throw errors.RANGE_NOT_SATISFIABLE();
		}
		if ((status !== 200 && status !== 206) || !body) {
			throw new TypeError("Expected a binary media response");
		}
		return { status, headers: Object.fromEntries(response.headers), body };
	}),

	headContent: os.headContent.handler(async ({ input }) => {
		const response = await mediaFileResponse(input, {
			method: "HEAD",
			headers: new Headers(),
		});
		return {
			headers: Object.fromEntries(response.headers),
			// The fetch adapter drops representation headers for undefined bodies.
			// The HTTP entry point discards this empty stream before sending HEAD.
			body: new ReadableStream<Uint8Array>({
				start(controller) {
					controller.close();
				},
			}),
		};
	}),

	getThumbnail: os.getThumbnail.handler(({ input }) =>
		readMediaThumbnail(input.sourceId, input.mediaId, input.size, input.t),
	),

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
	move: os.move.handler(({ input }) =>
		MediaService.moveMedia(input.mediaId, input.targetSourceId),
	),

	reserveUploads: os.reserveUploads.handler(({ input }) =>
		reserveImportFiles(input.sourceId, input.filenames, "import_upload"),
	),
	upload: os.upload.handler(async ({ input, errors }) => {
		const options = {
			filename: input.filename,
			description: input.description,
			sourceUrl: input.sourceUrl,
			overwrite: input.overwrite === "true",
			autoIncrement: input.autoIncrement === "true",
		};
		if (!input.reservationId)
			return MediaService.uploadMedia(input.sourceId, input.file, options);
		try {
			return await submitBatchUpload(
				input.sourceId,
				input.reservationId,
				input.file,
				options,
			);
		} catch (error) {
			if (await isUploadBatchCancelled(input.sourceId, input.reservationId))
				throw errors.BATCH_CANCELLED();
			throw error;
		}
	}),

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
		return { success: true };
	}),

	/**
	 * Bulk move multiple media items within the source
	 */
	bulkMove: os.bulkMove.handler(async ({ input }) => {
		return BulkOperationService.bulkMoveMedia(
			input.mediaSourceId,
			input.mediaIds,
			input.destinationPath,
		);
	}),

	/**
	 * Bulk add/remove tags on multiple media items
	 */
	bulkTag: os.bulkTag.handler(async ({ input }) => {
		try {
			await BulkOperationService.bulkTagMedia(
				input.mediaSourceId,
				input.mediaIds,
				input.tagsToAdd,
				input.tagsToRemove,
			);
		} catch (error) {
			if (error instanceof ResourceConflictError)
				throw new ORPCError("CONFLICT", { message: error.message });
			throw error;
		}
		return { success: true };
	}),

	updatePositiveTags: os.updatePositiveTags.handler(async ({ input }) => {
		try {
			await services.getMediaRepository().updatePositiveTags(input);
		} catch (error) {
			if (error instanceof ResourceNotFoundError)
				throw new ORPCError("NOT_FOUND", { message: error.message });
			if (error instanceof ResourceConflictError)
				throw new ORPCError("CONFLICT", { message: error.message });
			throw error;
		}
		return { success: true };
	}),

	/**
	 * Bulk copy multiple media items to another source
	 */
	bulkCopyToSource: os.bulkCopyToSource.handler(async ({ input }) => {
		return BulkOperationService.bulkCopyToSource(
			input.mediaSourceId,
			input.mediaIds,
			input.targetSourceId,
		);
	}),

	/**
	 * Bulk move multiple media items to another source
	 */
	bulkMoveToSource: os.bulkMoveToSource.handler(async ({ input }) => {
		return BulkOperationService.bulkMoveToSource(
			input.mediaSourceId,
			input.mediaIds,
			input.targetSourceId,
		);
	}),
});
