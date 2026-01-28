/**
 * MediaProcessingService - Unified entry point for media registration and processing
 */

import path from "node:path";
// Registry for backward compatibility proxy

import type { ConfigServiceImpl } from "~/application/services/config-service";
import type { Media, MediaMetadataContext } from "~/domain/media/schemas";
// Repository Interfaces
import type { IAuthorRepository } from "~/domain/repositories/author-repository";
import type { CharacterRepository } from "~/domain/repositories/character-repository";
import type { IIpRepository } from "~/domain/repositories/ip-repository";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import type { IProjectRepository } from "~/domain/repositories/project-repository";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type { TagRepository } from "~/domain/repositories/tag-repository";
import type { Job } from "~/infrastructure/db/schema";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { generateThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

export class MediaProcessingServiceImpl {
  private readonly sourceRepo: SourceRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly tagRepo: TagRepository;
  private readonly authorRepo: IAuthorRepository;
  private readonly characterRepo: CharacterRepository;
  private readonly ipRepo: IIpRepository;
  private readonly projectRepo: IProjectRepository;
  private readonly jobRepo: IJobRepository;
  private readonly configService: ConfigServiceImpl;

  // biome-ignore lint/nursery/useMaxParams: DI requires multiple repositories
  constructor(
    sourceRepo: SourceRepository,
    mediaRepo: IMediaRepository,
    tagRepo: TagRepository,
    authorRepo: IAuthorRepository,
    characterRepo: CharacterRepository,
    ipRepo: IIpRepository,
    projectRepo: IProjectRepository,
    jobRepo: IJobRepository,
    configService: ConfigServiceImpl
  ) {
    this.sourceRepo = sourceRepo;
    this.mediaRepo = mediaRepo;
    this.tagRepo = tagRepo;
    this.authorRepo = authorRepo;
    this.characterRepo = characterRepo;
    this.ipRepo = ipRepo;
    this.projectRepo = projectRepo;
    this.jobRepo = jobRepo;
    this.configService = configService;
  }

  private get enableAutoTagging(): boolean {
    return this.configService.get().jobs.enableAutoTagging;
  }

  /**
   * Unified entry point for media registration and processing.
   */
  async registerAndProcess(
    mediaSourceId: string,
    relativePath: string,
    contextMetadata?: Partial<MediaMetadataContext>
  ): Promise<Media> {
    const source = await this.sourceRepo.findById(mediaSourceId);
    if (!source || source.type !== "local") {
      throw new Error(
        `Source not found or not a local source: ${mediaSourceId}`
      );
    }

    const basePath = (source.connectionInfo as { path: string }).path;
    const fullPath = path.join(basePath, relativePath);

    // Get file metadata
    const fileMetadata = await LocalMediaStorage.getFileMetadata(fullPath);

    // Determine media type
    const ext = path.extname(relativePath).toLowerCase();
    const extensions = this.configService.get().media.supportedExtensions;
    let mediaType: "image" | "video" | "audio" = "image";
    if (extensions.video.includes(ext)) {
      mediaType = "video";
    } else if (extensions.audio.includes(ext)) {
      mediaType = "audio";
    }

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
    await this.jobRepo.create({
      type: "processMedia",
      mediaSourceId,
      payload: {
        mediaId: media.id,
        sourcePath: basePath,
        type: "processMedia",
      },
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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Refactor legacy logic later
  async executeProcessMediaJob(job: Job): Promise<void> {
    if (job.type !== "processMedia") {
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Payload structure known for this job type
    const payload = job.payload as any;
    const mediaId = payload?.mediaId;

    if (!mediaId) {
      logger.error({ jobId: job.id }, "Missing mediaId in job payload");
      return;
    }

    const media = await this.mediaRepo.findById(mediaId);
    if (!media) {
      logger.warn({ mediaId }, "Media not found for processMedia job");
      return;
    }

    const mediaPath = path.join(payload.sourcePath, media.filePath);

    const mediaSourceId = job.mediaSourceId;
    if (!mediaSourceId) {
      logger.error({ jobId: job.id }, "Missing mediaSourceId in job");
      return;
    }

    // Step 1: Metadata extraction
    if (!payload?.skipMetadataExtraction) {
      try {
        const metadata = await ImageProcessor.extractMetadata(mediaPath);

        await this.mediaRepo.upsertGenerationInfo(
          media.id,
          typeof metadata.prompt === "object"
            ? JSON.stringify(metadata.prompt)
            : (metadata.prompt as string | null),
          metadata.workflow as object | null
        );

        if (metadata.tags.length > 0) {
          await this.tagRepo.addTagsToMedia(
            media.id,
            metadata.tags,
            "comfyui_workflow"
          );
        }
      } catch (e) {
        logger.warn(
          { err: e, mediaId },
          "Metadata extraction failed, continuing..."
        );
      }
    }

    // Step 2: Thumbnail generation
    try {
      await generateThumbnail(media, payload.sourcePath, mediaSourceId);
      SseManager.sendEvent(mediaSourceId, "thumbnail-generated", {
        mediaId: media.id,
      });
    } catch (e) {
      logger.error({ err: e, mediaId }, "Thumbnail generation failed");
    }

    // Step 3: AI tagging
    if (this.enableAutoTagging && !payload?.skipMetadataExtraction) {
      try {
        const { taggingService } = await import(
          "~/application/services/tagging-service"
        );
        await taggingService.getTagsForMedia(mediaSourceId, mediaId);
      } catch (e) {
        logger.warn({ err: e, mediaId }, "AI tagging failed, skipping");
      }
    }
  }

  private async registerContextMetadata(
    mediaId: string,
    context: Partial<MediaMetadataContext>
  ): Promise<void> {
    if (context.sourceUrls?.length) {
      await this.mediaRepo.addUrls(mediaId, context.sourceUrls);
    }

    if (context.authors?.length) {
      await this.registerAuthors(mediaId, context.authors);
    }

    if (context.tags?.length) {
      await this.tagRepo.addTagsToMedia(
        mediaId,
        context.tags.map((t) => ({
          name: t.name,
          type: (t.type ?? "positive") as "positive" | "negative",
          confidence: t.confidence,
        })),
        "user_provided"
      );
    }

    if (context.characters?.length) {
      await this.registerCharacters(mediaId, context.characters);
    }

    if (context.ips?.length) {
      await this.registerIps(mediaId, context.ips);
    }

    if (context.projects?.length) {
      await this.registerProjects(mediaId, context.projects);
    }
  }

  private async registerAuthors(
    mediaId: string,
    authors: NonNullable<MediaMetadataContext["authors"]>
  ): Promise<void> {
    for (const author of authors) {
      try {
        const createdAuthor = await this.authorRepo.create({
          name: author.name,
          accountId: author.accountId ?? null,
        });
        await this.authorRepo.addMedia(mediaId, createdAuthor.id);
      } catch (e) {
        logger.warn({ err: e, author }, "Failed to register author");
      }
    }
  }

  private async registerCharacters(
    mediaId: string,
    characters: NonNullable<MediaMetadataContext["characters"]>
  ): Promise<void> {
    for (const charData of characters) {
      try {
        const created = await this.characterRepo.create({
          name: charData.name,
          description: charData.description ?? "",
        });
        await this.characterRepo.addToMedia(
          mediaId,
          created.id,
          charData.confidence
        );
      } catch (e) {
        logger.warn(
          { err: e, character: charData },
          "Failed to register character"
        );
      }
    }
  }

  private async registerIps(
    mediaId: string,
    ipsData: NonNullable<MediaMetadataContext["ips"]>
  ): Promise<void> {
    for (const ipData of ipsData) {
      try {
        const created = await this.ipRepo.create({
          name: ipData.name,
          description: ipData.description ?? "",
        });
        await this.ipRepo.addMedia(mediaId, created.id);
      } catch (e) {
        logger.warn({ err: e, ip: ipData }, "Failed to register IP");
      }
    }
  }

  private async registerProjects(
    mediaId: string,
    projectsData: NonNullable<MediaMetadataContext["projects"]>
  ): Promise<void> {
    for (const projData of projectsData) {
      try {
        const created = await this.projectRepo.create({
          name: projData.name,
          description: projData.description ?? "",
        });
        await this.projectRepo.addMedia(mediaId, created.id);
      } catch (e) {
        logger.warn(
          { err: e, project: projData },
          "Failed to register project"
        );
      }
    }
  }

  /**
   * Adds context metadata to an existing media item.
   * This is useful when metadata becomes available after initial registration (e.g., from download).
   */
  async addContextMetadataToExistingMedia(
    mediaId: string,
    context: Partial<MediaMetadataContext>
  ): Promise<void> {
    const media = await this.mediaRepo.findById(mediaId);
    if (!media) {
      throw new Error(`Media not found: ${mediaId}`);
    }

    // Update description if provided
    if (context.description) {
      await this.mediaRepo.update(mediaId, {
        description: context.description,
      });
    }

    // Register related data using the shared private method
    await this.registerContextMetadata(mediaId, context);
  }
}

// Backward compatibility proxy
export const MediaProcessingService = {
  registerAndProcess: async (
    mediaSourceId: string,
    relativePath: string,
    contextMetadata?: Partial<MediaMetadataContext>
  ) => {
    const { services } = await import("~/application/registry");
    return services
      .getMediaProcessingService()
      .registerAndProcess(mediaSourceId, relativePath, contextMetadata);
  },

  executeProcessMediaJob: async (job: Job) => {
    const { services } = await import("~/application/registry");
    return services.getMediaProcessingService().executeProcessMediaJob(job);
  },

  addContextMetadataToExistingMedia: async (
    mediaId: string,
    context: Partial<MediaMetadataContext>
  ) => {
    const { services } = await import("~/application/registry");
    return services
      .getMediaProcessingService()
      .addContextMetadataToExistingMedia(mediaId, context);
  },
};
