/**
 * MediaProcessingService - Unified entry point for media registration and processing
 */

import path from "node:path";

// Registry for backward compatibility proxy

import type { JobRecord } from "@solid-imager/application/ports/job-repository";
import { updateMediaContextMetadata } from "@solid-imager/application/services/media-context-metadata";
import { runProcessMediaJob } from "@solid-imager/application/services/process-media-runner";
import type { IConfigService } from "@solid-imager/core";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
import { inferMediaType } from "@solid-imager/core/domain/media/utils/media-type-utils";
// Repository Interfaces
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { CharacterServiceImpl } from "~/application/services/character-service";
import { queueMediaProcessingJob } from "~/application/services/media-processing-job";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

export class MediaProcessingServiceImpl {
	private readonly sourceRepo: SourceRepository;
	private readonly mediaRepo: IMediaRepository;
	private readonly tagRepo: TagRepository;
	private readonly authorRepo: IAuthorRepository;
	private readonly characterService: CharacterServiceImpl;
	private readonly ipRepo: IIpRepository;
	private readonly projectRepo: IProjectRepository;
	private readonly jobRepo: IJobRepository;
	private readonly configService: IConfigService;

	constructor(
		sourceRepo: SourceRepository,
		mediaRepo: IMediaRepository,
		tagRepo: TagRepository,
		authorRepo: IAuthorRepository,
		characterService: CharacterServiceImpl,
		ipRepo: IIpRepository,
		projectRepo: IProjectRepository,
		jobRepo: IJobRepository,
		configService: IConfigService,
	) {
		this.sourceRepo = sourceRepo;
		this.mediaRepo = mediaRepo;
		this.tagRepo = tagRepo;
		this.authorRepo = authorRepo;
		this.characterService = characterService;
		this.ipRepo = ipRepo;
		this.projectRepo = projectRepo;
		this.jobRepo = jobRepo;
		this.configService = configService;
	}

	private get enableAutoTagging(): boolean {
		return this.configService.getConfig().jobs.enableAutoTagging;
	}

	/**
	 * Unified entry point for media registration and processing.
	 */
	async registerAndProcess(
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	): Promise<Media> {
		const source = await this.sourceRepo.findById(mediaSourceId);
		if (!source || source.type !== "local") {
			throw new Error(
				`Source not found or not a local source: ${mediaSourceId}`,
			);
		}

		const basePath = (source.connectionInfo as { path: string }).path;
		const fullPath = path.join(basePath, relativePath);

		// Get file metadata
		const fileMetadata = await ServerMediaStorage.getFileMetadata(fullPath);

		// Determine media type
		const extensions = this.configService.getConfig().media.supportedExtensions;
		const mediaType = inferMediaType(relativePath, extensions) ?? "image";

		// Step 1: Create media record
		const media = await this.mediaRepo.create({
			mediaSourceId,
			filePath: relativePath,
			fileName: path.basename(relativePath),
			mediaType,
			width: fileMetadata.width,
			height: fileMetadata.height,
			fileSize: fileMetadata.size,
			description: contextMetadata?.description ?? null,
			createdAt: contextMetadata?.createdAt ?? fileMetadata.createdAt,
			modifiedAt: fileMetadata.modifiedAt,
		});

		// Step 2: Register related data
		if (contextMetadata) {
			await this.registerContextMetadata(media.id, contextMetadata);
		}

		// Step 3: Queue processMedia job
		await queueMediaProcessingJob({
			jobRepo: this.jobRepo,
			mediaId: media.id,
			mediaSourceId,
			sourcePath: basePath,
		});

		// Notify clients
		SseManager.sendEvent(mediaSourceId, "media-added", {
			mediaId: media.id,
			filePath: media.filePath,
		});

		return media;
	}

	/**
	 * Executes the processMedia job.
	 */
	async executeProcessMediaJob(job: JobRecord): Promise<void> {
		if (job.type !== "processMedia") {
			return;
		}

		await runProcessMediaJob(job, {
			mediaRepository: this.mediaRepo,
			tagRepository: this.tagRepo,
			pathJoin: path.join,
			extractMetadata: ImageProcessor.extractMetadata,
			generateThumbnail: async ({ media, sourcePath, mediaSourceId }) => {
				await generateThumbnail(media, sourcePath, mediaSourceId);
			},
			emitThumbnailGenerated: ({ media, mediaSourceId }) => {
				SseManager.sendEvent(mediaSourceId, "thumbnail-generated", {
					mediaId: media.id,
				});
			},
			queueAutoTagging: async ({ mediaId, mediaSourceId }) => {
				try {
					await this.jobRepo.createIfUnique({
						type: "auto_tagging",
						mediaSourceId,
						payload: {
							mediaId,
						},
					});
				} catch (error) {
					logger.warn(
						{ err: error, mediaId },
						"Failed to queue AI tagging job",
					);
				}
			},
			isAutoTaggingEnabled: () => this.enableAutoTagging,
			logger,
		});
	}

	private async registerContextMetadata(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void> {
		await updateMediaContextMetadata(
			mediaId,
			context,
			{
				mediaRepository: this.mediaRepo,
				authorRepository: this.authorRepo,
				characterRepository: this.characterService.characterRepo,
				ipRepository: this.ipRepo,
				projectRepository: this.projectRepo,
				tagRepository: this.tagRepo,
				logger,
			},
			tx,
		);
	}

	/**
	 * Adds context metadata to an existing media item.
	 * This is useful when metadata becomes available after initial registration (e.g., from download).
	 */
	async addContextMetadataToExistingMedia(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void> {
		const media = await this.mediaRepo.findById(mediaId, tx);
		if (!media) {
			throw new Error(`Media not found: ${mediaId}`);
		}

		// Update description if provided
		if (context.description) {
			await this.mediaRepo.update(
				mediaId,
				{
					description: context.description,
				},
				tx,
			);
		}

		// Register related data using the shared private method
		await this.registerContextMetadata(mediaId, context, tx);
	}
}

// Backward compatibility proxy
export const MediaProcessingService = {
	registerAndProcess: async (
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	) => {
		const { services } = await import("~/application/registry");
		return services
			.getMediaProcessingService()
			.registerAndProcess(mediaSourceId, relativePath, contextMetadata);
	},

	executeProcessMediaJob: async (job: JobRecord) => {
		const { services } = await import("~/application/registry");
		return services.getMediaProcessingService().executeProcessMediaJob(job);
	},

	addContextMetadataToExistingMedia: async (
		mediaId: string,
		context: Partial<MediaMetadataContext>,
	) => {
		const { services } = await import("~/application/registry");
		return services
			.getMediaProcessingService()
			.addContextMetadataToExistingMedia(mediaId, context);
	},
};
