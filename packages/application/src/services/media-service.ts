/**
 * MediaServiceImpl - Thin facade that delegates to focused services.
 * Maintains backward compatibility with IMediaService interface.
 */

import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	FindDuplicatesRequest,
	FindDuplicatesResponse,
	Media,
	MediaDetails,
	MediaGenerationInfo,
	MediaSearchResponse,
	MediaTag,
} from "@solid-imager/core/domain/media/schemas";
import type {
	UploadMediaRequest,
	UploadResponse,
} from "@solid-imager/core/domain/media/upload-schemas";
import type { DeferredActions, IMediaService } from "../ports/media-service";
import type { MediaQueryService } from "./media-query-service";
import type { MediaTransferService } from "./media-transfer-service";
import type { MediaUploadService } from "./media-upload-service";

export { validateFileSignature } from "./media-upload-service";

export class MediaServiceImpl implements IMediaService {
	constructor(
		private readonly queryService: MediaQueryService,
		private readonly uploadService: MediaUploadService,
		private readonly transferService: MediaTransferService,
	) {}

	startProcessing(_mediaSourceId: string) {
		// No-op: JobWorker is handling this globally.
	}

	async searchMedia(
		mediaSourceId: string | undefined | null,
		params: unknown,
	): Promise<MediaSearchResponse> {
		return this.queryService.searchMedia(mediaSourceId, params);
	}

	async searchMediaInDirectory(
		mediaSourceId: string,
		directoryPath: string,
		params: { query?: string; tags?: string[] },
	): Promise<Media[]> {
		return this.queryService.searchMediaInDirectory(
			mediaSourceId,
			directoryPath,
			params,
		);
	}

	async uploadMedia(
		mediaSourceId: string,
		file: File,
		options: UploadMediaRequest,
	): Promise<UploadResponse> {
		return this.uploadService.uploadMedia(mediaSourceId, file, options);
	}

	async getMediaDetails(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaDetails> {
		return this.queryService.getMediaDetails(mediaSourceId, mediaId);
	}

	async getMediaContent(
		mediaSourceId: string,
		mediaId: string,
	): Promise<{ buffer: Uint8Array; contentType: string }> {
		return this.queryService.getMediaContent(mediaSourceId, mediaId);
	}

	async registerExistingMedia(mediaSourceId: string, directoryPath: string) {
		return this.uploadService.registerExistingMedia(
			mediaSourceId,
			directoryPath,
		);
	}

	async getAllMedia(mediaSourceId: string): Promise<Media[]> {
		return this.queryService.getAllMedia(mediaSourceId);
	}

	async getMedia(mediaSourceId: string, mediaId: string): Promise<Media> {
		return this.queryService.getMedia(mediaSourceId, mediaId);
	}

	async updateMedia(
		mediaSourceId: string,
		mediaId: string,
		updates: unknown,
		tx?: Transaction,
	): Promise<Media> {
		return this.transferService.updateMedia(
			mediaSourceId,
			mediaId,
			updates,
			tx,
		);
	}

	async reprocessMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		return this.queryService.reprocessMetadata(mediaSourceId, mediaId);
	}

	async getMediaTags(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaTag[]> {
		return this.queryService.getMediaTags(mediaSourceId, mediaId);
	}

	async getMediaMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		return this.queryService.getMediaMetadata(mediaSourceId, mediaId);
	}

	async copyMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		return this.transferService.copyMedia(sourceMediaId, targetSourceId, tx);
	}

	async moveMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
		return this.transferService.moveMedia(sourceMediaId, targetSourceId, tx);
	}

	async deleteMedia(
		mediaSourceId: string,
		mediaId: string,
		tx?: Transaction,
	): Promise<DeferredActions | undefined> {
		return this.transferService.deleteMedia(mediaSourceId, mediaId, tx);
	}

	async findDuplicates(
		request: FindDuplicatesRequest,
	): Promise<FindDuplicatesResponse> {
		return this.queryService.findDuplicates(request);
	}
}
