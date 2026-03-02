/**
 * MediaProcessingService - Unified entry point for media registration and processing
 */

import path from "node:path";

// Registry for backward compatibility proxy

import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
  Media,
  MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
// Repository Interfaces
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import type { CharacterServiceImpl } from "~/application/services/character-service";
import type { ServerConfigService } from "~/application/services/server-config-service";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
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
  private readonly configService: ServerConfigService;

  // biome-ignore lint/nursery/useMaxParams: DI requires multiple repositories
  constructor(
    sourceRepo: SourceRepository,
    mediaRepo: IMediaRepository,
    tagRepo: TagRepository,
    authorRepo: IAuthorRepository,
    characterService: CharacterServiceImpl,
    ipRepo: IIpRepository,
    projectRepo: IProjectRepository,
    jobRepo: IJobRepository,
    configService: ServerConfigService
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
    const fileMetadata = await ServerMediaStorage.getFileMetadata(fullPath);

    // Determine media type
    const ext = path.extname(relativePath).toLowerCase();
    const extensions = this.configService.getConfig().media.supportedExtensions;
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
    if (
      this.enableAutoTagging &&
      !payload?.skipMetadataExtraction &&
      media.mediaType === "image"
    ) {
      try {
        await this.jobRepo.create({
          type: "auto_tagging",
          mediaSourceId,
          payload: {
            mediaId: media.id,
          },
        });
      } catch (e) {
        logger.warn({ err: e, mediaId }, "Failed to queue AI tagging job");
      }
    }
  }

  private async registerContextMetadata(
    mediaId: string,
    context: Partial<MediaMetadataContext>,
    tx?: Transaction
  ): Promise<void> {
    if (context.sourceUrls?.length) {
      await this.mediaRepo.addUrls(mediaId, context.sourceUrls, tx);
    }

    if (context.authors?.length) {
      await this.registerAuthors(mediaId, context.authors, tx);
    }

    if (context.tags?.length) {
      await this.tagRepo.addTagsToMedia(
        mediaId,
        context.tags.map((t) => ({
          name: t.name,
          type: (t.type ?? "positive") as "positive" | "negative",
          confidence: t.confidence,
        })),
        "user_provided",
        tx
      );
    }

    if (context.ips?.length) {
      await this.registerIps(mediaId, context.ips, tx);
    }

    if (context.characters?.length) {
      await this.registerCharacters(
        mediaId,
        context.characters,
        context.ips?.map((ip) => ip.name),
        tx
      );
    }

    if (context.projects?.length) {
      await this.registerProjects(mediaId, context.projects, tx);
    }
  }

  private async registerAuthors(
    mediaId: string,
    authors: NonNullable<MediaMetadataContext["authors"]>,
    tx?: Transaction
  ): Promise<void> {
    for (const author of authors) {
      try {
        let createdAuthor = await this.authorRepo.findByName(author.name, tx);
        if (!createdAuthor) {
          createdAuthor = await this.authorRepo.create(
            {
              name: author.name,
              accountId: author.accountId ?? null,
            },
            tx
          );
        }
        await this.authorRepo.addMedia(mediaId, createdAuthor.id, tx);
      } catch (e) {
        logger.warn({ err: e, author }, "Failed to register author");
      }
    }
  }

  private async registerCharacters(
    mediaId: string,
    characters: NonNullable<MediaMetadataContext["characters"]>,
    currentIpNames?: string[],
    tx?: Transaction
  ): Promise<void> {
    for (const charData of characters) {
      try {
        await this._registerSingleCharacter(
          mediaId,
          charData,
          currentIpNames,
          tx
        );
      } catch (e) {
        logger.warn(
          { err: e, character: charData },
          "Failed to register character"
        );
      }
    }
  }

  private async _registerSingleCharacter(
    mediaId: string,
    charData: NonNullable<MediaMetadataContext["characters"]>[number],
    currentIpNames?: string[],
    tx?: Transaction
  ): Promise<void> {
    let character: Character | null = await this.characterService.findByName(
      charData.name
    );

    const ipIdsToLink = await this._resolveIpIds(currentIpNames, tx);

    if (!character) {
      character = await this.characterService.createCharacter({
        name: charData.name,
        description: charData.description ?? "",
        ipIds: ipIdsToLink,
      });
    } else if (ipIdsToLink.length > 0) {
      character = await this._updateCharacterIps(character, ipIdsToLink);
    }

    if (!character) {
      return;
    }

    // Re-link character to media if necessary
    // We can use characterService.addCharacterToMedia(mediaId, character.id) but it will call linkCharacterIps again.
    // That's actually fine/safe.
    // NOTE: CharacterService.addCharacterToMedia now uses internal transactionManager, so we might want to call repo directly if we already have a tx?
    // But for simplicity and consistent auto-link logic, service call is safer.
    // If tx is provided, we should probably prefer repo call or update service to accept tx.
    const charRepo = this.characterService.characterRepo;
    const confidence = charData.confidence ?? 1;
    await charRepo.addToMedia(mediaId, character.id, confidence, "manual", tx);
    await this.characterService.linkCharacterIps(mediaId, character, tx);
  }

  private async _resolveIpIds(
    currentIpNames?: string[],
    tx?: Transaction
  ): Promise<string[]> {
    if (!currentIpNames?.length) {
      return [];
    }

    const foundIps = await this.ipRepo.findByNames(currentIpNames, tx);
    return foundIps.map((ip) => ip.id);
  }

  private async _updateCharacterIps(
    character: Character,
    ipIdsToLink: string[]
  ): Promise<Character> {
    const existingIpIds = character.ips?.map((i) => i.id) || [];
    const newIpIds = [...new Set([...existingIpIds, ...ipIdsToLink])];

    if (newIpIds.length > existingIpIds.length) {
      return await this.characterService.updateCharacter(character.id, {
        ipIds: newIpIds,
      });
    }
    return character;
  }

  private async registerIps(
    mediaId: string,
    ipsData: NonNullable<MediaMetadataContext["ips"]>,
    tx?: Transaction
  ): Promise<void> {
    // Normalize names and remove duplicates to avoid redundant creation attempts
    const normalizedIpsMap = new Map<
      string,
      NonNullable<MediaMetadataContext["ips"]>[number]
    >();
    for (const ip of ipsData) {
      const normalizedName = ip.name.trim();
      if (!normalizedIpsMap.has(normalizedName)) {
        normalizedIpsMap.set(normalizedName, ip);
      }
    }

    for (const [name, ipData] of normalizedIpsMap) {
      try {
        let created = await this.ipRepo.findByName(name, tx);
        if (!created) {
          created = await this.ipRepo.create(
            {
              name,
              description: ipData.description ?? "",
            },
            tx
          );
        }
        await this.ipRepo.addMedia(
          mediaId,
          created.id,
          ipData.confidence,
          "manual",
          tx
        );
      } catch (e) {
        logger.warn({ err: e, ip: ipData }, "Failed to register IP");
      }
    }
  }

  private async registerProjects(
    mediaId: string,
    projectsData: NonNullable<MediaMetadataContext["projects"]>,
    tx?: Transaction
  ): Promise<void> {
    for (const projData of projectsData) {
      try {
        let created = await this.projectRepo.findByName(projData.name, tx);
        if (!created) {
          created = await this.projectRepo.create(
            {
              name: projData.name,
              description: projData.description ?? "",
            },
            tx
          );
        }
        await this.projectRepo.addMedia(mediaId, created.id, tx);
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
    context: Partial<MediaMetadataContext>,
    tx?: Transaction
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
        tx
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
