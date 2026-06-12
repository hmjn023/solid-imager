import path from "node:path";
import type { IMediaStorage } from "@solid-imager/core";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import {
	type FindDuplicatesRequest,
	type FindDuplicatesResponse,
	type Media,
	type MediaDetails,
	type MediaGenerationInfo,
	type MediaSearchResponse,
	mediaIdSchema,
	mediaSearchRequestSchema,
	mediaSourceIdSchema,
} from "@solid-imager/core/domain/media/schemas";
import { getContentTypeFromExtension } from "@solid-imager/core/domain/media/utils/media-type-utils";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { ILogger } from "../ports/media-service";

export class MediaQueryService {
	constructor(
		private readonly mediaRepository: IMediaRepository,
		private readonly sourceRepository: SourceRepository,
		private readonly storageService: IMediaStorage,
		private readonly tagRepository: TagRepository,
		private readonly imageProcessor: IImageProcessor,
		private readonly logger: ILogger,
	) {}

	async searchMedia(
		mediaSourceId: string | undefined | null,
		params: unknown,
	): Promise<MediaSearchResponse> {
		const searchRequest = mediaSearchRequestSchema.parse(params);
		if (mediaSourceId) {
			const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
			return await this.mediaRepository.search(
				validatedSourceId,
				searchRequest,
			);
		}
		return await this.mediaRepository.globalSearch(searchRequest);
	}

	async searchMediaInDirectory(
		mediaSourceId: string,
		directoryPath: string,
		params: { query?: string; tags?: string[] },
	): Promise<Media[]> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		return await this.mediaRepository.searchInDirectory(
			validatedSourceId,
			directoryPath,
			params,
		);
	}

	async getMediaDetails(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaDetails> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const mediaDetails =
			await this.mediaRepository.getDetails(validatedMediaId);
		if (!mediaDetails) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (mediaDetails.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		let finalGenerationInfo = mediaDetails.generationInfo;

		if (!finalGenerationInfo) {
			finalGenerationInfo = await this.extractAndUpdateMetadata(
				mediaDetails as Media,
				validatedSourceId,
			);
		}

		const result: MediaDetails = {
			...mediaDetails,
			generationInfo: finalGenerationInfo
				? {
						...finalGenerationInfo,
						aiGenerated: finalGenerationInfo.aiGenerated ?? false,
						modelName: finalGenerationInfo.modelName ?? "",
						seed: finalGenerationInfo.seed ?? -1,
						cfgScale: finalGenerationInfo.cfgScale ?? 0,
						steps: finalGenerationInfo.steps ?? 0,
					}
				: null,
		};
		return result;
	}

	async getMediaContent(
		mediaSourceId: string,
		mediaId: string,
	): Promise<{ buffer: Uint8Array; contentType: string }> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const mediaSource = await this.sourceRepository.findById(validatedSourceId);
		if (!mediaSource) {
			throw new ResourceNotFoundError("Media Source", validatedSourceId);
		}

		const media = await this.mediaRepository.findById(validatedMediaId);
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		if (mediaSource.type !== "local") {
			throw new Error("Only local media sources is supported.");
		}
		const connectionInfo = mediaSource.connectionInfo as { path: string };
		const buffer = await this.storageService.getFile(
			connectionInfo.path,
			media.filePath,
		);

		const contentType = getContentTypeFromExtension(media.fileName);

		return { buffer, contentType };
	}

	async getAllMedia(mediaSourceId: string): Promise<Media[]> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		return await this.mediaRepository.findAllBySourceId(validatedSourceId);
	}

	async getMedia(mediaSourceId: string, mediaId: string): Promise<Media> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);
		const media = await this.mediaRepository.findById(validatedMediaId);
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}
		return media;
	}

	async reprocessMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const media = await this.mediaRepository.findById(validatedMediaId);
		if (!media || media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}

		return await this.extractAndUpdateMetadata(media, validatedSourceId);
	}

	async getMediaTags(mediaSourceId: string, mediaId: string) {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const media = await this.mediaRepository.findById(validatedMediaId);
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		return await this.mediaRepository.getTags(validatedMediaId);
	}

	async getMediaMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null> {
		const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
		const validatedMediaId = mediaIdSchema.parse(mediaId);

		const media = await this.mediaRepository.findById(validatedMediaId);
		if (!media) {
			throw new ResourceNotFoundError("Media", validatedMediaId);
		}
		if (media.mediaSourceId !== validatedSourceId) {
			throw new ResourceNotFoundError("Media not found in source");
		}

		const generationInfo = await this.mediaRepository.getGenerationInfo(
			validatedMediaId,
		);
		return generationInfo
			? {
					...generationInfo,
					aiGenerated: generationInfo.aiGenerated ?? false,
					modelName: generationInfo.modelName ?? "",
					seed: generationInfo.seed ?? -1,
					cfgScale: generationInfo.cfgScale ?? 0,
					steps: generationInfo.steps ?? 0,
				}
			: null;
	}

	async findDuplicates(
		request: FindDuplicatesRequest,
	): Promise<FindDuplicatesResponse> {
		return this.mediaRepository.findDuplicates(request);
	}

	private async extractAndUpdateMetadata(
		media: Media,
		sourceId: string,
	): Promise<MediaGenerationInfo | null> {
		const mediaSource = await this.sourceRepository.findById(sourceId);
		if (!mediaSource || mediaSource.type !== "local") {
			return null;
		}

		const connectionInfo = mediaSource.connectionInfo as { path: string };
		const fullPath = path.join(connectionInfo.path, media.filePath);

		try {
			const metadata = await this.imageProcessor.extractMetadata(fullPath);

			this.logger.info(
				{
					mediaId: media.id,
					fullPath,
					tagsCount: metadata.tags.length,
					hasWorkflow: !!metadata.workflow,
					hasPrompt: !!metadata.prompt,
				},
				"[MediaQueryService] extractAndUpdateMetadata result",
			);

			await this.mediaRepository.upsertGenerationInfo(
				media.id,
				typeof metadata.prompt === "object"
					? JSON.stringify(metadata.prompt)
					: (metadata.prompt as string | null),
				metadata.workflow as object | null,
			);

			if (metadata.tags.length > 0) {
				await this.tagRepository.addTagsToMedia(
					media.id,
					metadata.tags,
					"comfyui_workflow",
				);
			}

			return await this.mediaRepository.getGenerationInfo(media.id);
		} catch (e) {
			this.logger.error(
				{ err: e, mediaId: media.id, fullPath },
				"[MediaQueryService] extractAndUpdateMetadata FAILED",
			);
			return null;
		}
	}
}
