/**
 * MediaService Interface Class
 * Refactored to allow Dependency Injection
 */

import path from "node:path";
import { services } from "~/application/registry"; // Default registry
import { ResourceNotFoundError } from "~/domain/errors";
import type { Transaction } from "~/domain/interfaces/transaction-manager";
import {
  type AddMediaRequest,
  type Media,
  type MediaDetails,
  type MediaGenerationInfo,
  mediaIdSchema,
  mediaSearchRequestSchema,
  mediaSourceIdSchema,
  updateMediaRequestSchema,
} from "~/domain/media/schemas";
import {
  type UploadResponse,
  uploadMediaRequestSchema,
} from "~/domain/media/upload-schemas";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "~/domain/repositories/tag-repository"; // Added
import type { IImageProcessor } from "~/domain/services/image-processor";
import type { IStorageService } from "~/domain/services/storage-service";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import {
  deleteThumbnail,
  processMediaJob,
} from "~/infrastructure/jobs/thumbnails";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { MediaRepository } from "~/infrastructure/repositories/media-repository"; // Default implementation
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository"; // Default implementation
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

// Temporary registration of default implementations
// Ideally this should be done in a composition root
services.registerMediaRepository(MediaRepository);
// Avoid re-registering if already registered (e.g. by TaggingService)
try {
  services.getSourceRepository();
} catch {
  services.registerSourceRepository(new DrizzleSourceRepository());
}
services.registerStorageService(LocalMediaStorage);
services.registerTagRepository(TagRepository);
services.registerImageProcessor(ImageProcessor);

export class MediaServiceImpl {
  private readonly mediaRepository: IMediaRepository;
  private readonly sourceRepository: SourceRepository;
  private readonly storageService: IStorageService;
  private readonly tagRepository: TagRepositoryDef;
  private readonly imageProcessor: IImageProcessor;

  // biome-ignore lint/nursery/useMaxParams: Dependency injection
  constructor(
    mediaRepository: IMediaRepository,
    sourceRepository: SourceRepository,
    storageService: IStorageService,
    tagRepository: TagRepositoryDef,
    imageProcessor: IImageProcessor
  ) {
    this.mediaRepository = mediaRepository;
    this.sourceRepository = sourceRepository;
    this.storageService = storageService;
    this.tagRepository = tagRepository;
    this.imageProcessor = imageProcessor;
  }

  /**
   * Searches for media.
   */
  async searchMedia(mediaSourceId: string, params: unknown) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const searchRequest = mediaSearchRequestSchema.parse(params);
    return await this.mediaRepository.search(validatedSourceId, searchRequest);
  }

  /**
   * Searches for media in a directory.
   */
  async searchMediaInDirectory(
    mediaSourceId: string,
    directoryPath: string,
    params: { query?: string; tags?: string[] }
  ) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    return await this.mediaRepository.searchInDirectory(
      validatedSourceId,
      directoryPath,
      params
    );
  }

  /**
   * Uploads a media file.
   */
  async uploadMedia(
    mediaSourceId: string,
    file: File,
    formData: FormData
  ): Promise<UploadResponse> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const mediaSource = await this.sourceRepository.findById(validatedSourceId);

    if (!mediaSource) {
      throw new ResourceNotFoundError("Media Source", validatedSourceId);
    }

    if (mediaSource.type !== "local") {
      throw new Error(
        "Only local media sources are supported for uploads in Phase 1."
      );
    }

    const connectionInfo = mediaSource.connectionInfo as { path: string };
    const basePath = connectionInfo.path;

    const uploadRequest = uploadMediaRequestSchema.parse({
      filename: formData.get("filename")?.toString(),
      autoIncrement: formData.get("autoIncrement")?.toString(),
      description: formData.get("description")?.toString(),
      sourceUrl: formData.get("sourceUrl")?.toString(),
      overwrite: formData.get("overwrite")?.toString(),
    });

    // 1. Save File via StorageService
    const fileInfo = await this.storageService.saveFile(basePath, file, {
      filename: uploadRequest.filename,
      overwrite: uploadRequest.overwrite,
      autoIncrement: uploadRequest.autoIncrement,
    });

    // 2. Create Media Entry
    const newMedia: AddMediaRequest = {
      mediaSourceId: validatedSourceId,
      filePath: fileInfo.filePath,
      fileName: fileInfo.fileName,
      mediaType: "image", // TODO: Determine based on file type
      description: uploadRequest.description || null,
      width: fileInfo.width,
      height: fileInfo.height,
      fileSize: fileInfo.size,
      createdAt: fileInfo.createdAt,
      modifiedAt: fileInfo.modifiedAt,
    };

    let insertedMedia: Media;
    try {
      insertedMedia = await this.mediaRepository.create(newMedia);
    } catch (error) {
      // Handle race condition with FileWatcherService
      const existing = await this.mediaRepository.findByPath(
        validatedSourceId,
        fileInfo.filePath
      );
      if (existing) {
        insertedMedia = existing;
      } else {
        throw error;
      }
    }

    // Register URL if present (legacy support for sourceUrl in upload)
    if (uploadRequest.sourceUrl) {
      await this.mediaRepository.addUrls(insertedMedia.id, [
        uploadRequest.sourceUrl,
      ]);
    }

    // 3. Trigger Jobs
    addJobsToQueue(validatedSourceId, [
      { mediaId: insertedMedia.id, sourcePath: basePath, type: "thumbnail" },
      { mediaId: insertedMedia.id, sourcePath: basePath, type: "extractTags" },
    ]);

    startJobQueue(validatedSourceId, (job) =>
      processMediaJob(job, validatedSourceId)
    );

    return {
      success: true,
      filePath: fileInfo.filePath,
      conflict: fileInfo.conflict,
    };
  }

  /**
   * Retrieves media details including tags and generation info.
   */
  async getMediaDetails(
    mediaSourceId: string,
    mediaId: string
  ): Promise<MediaDetails> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await this.mediaRepository.findById(validatedMediaId);
    if (!media) {
      throw new ResourceNotFoundError("Media", validatedMediaId);
    }
    if (media.mediaSourceId !== validatedSourceId) {
      throw new ResourceNotFoundError("Media not found in source");
    }

    const [tags, generationInfo, authors, urls] = await Promise.all([
      this.mediaRepository.getTags(validatedMediaId),
      this.mediaRepository.getGenerationInfo(validatedMediaId),
      this.mediaRepository.getAuthors(validatedMediaId),
      this.mediaRepository.getUrls(validatedMediaId),
    ]);

    let finalGenerationInfo = generationInfo;

    // If generation info is not found, try to extract it (Lazy Extraction)
    if (!finalGenerationInfo) {
      finalGenerationInfo = await this.extractAndUpdateMetadata(
        media,
        validatedSourceId
      );
    }

    return {
      ...media,
      tags,
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
      authors,
      urls,
    };
  }

  /**
   * Retrieves media content (file buffer).
   */
  async getMediaContent(
    mediaSourceId: string,
    mediaId: string
  ): Promise<Buffer> {
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
    return this.storageService.getFile(connectionInfo.path, media.filePath);
  }

  /**
   * Registers existing media from a directory.
   */
  async registerExistingMedia(mediaSourceId: string, directoryPath: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const files = await this.storageService.scanDirectory(directoryPath);
    const newMediaItems: { id: string; filePath: string }[] = [];

    for (const file of files) {
      try {
        const relativePath = path.relative(directoryPath, file);
        const existing = await this.mediaRepository.findByPath(
          validatedSourceId,
          relativePath
        );

        if (!existing) {
          try {
            const metadata = await this.storageService.getFileMetadata(file);

            // Simple extension check for media type
            const ext = path.extname(file).toLowerCase();
            let mediaType: "image" | "video" | "audio" = "image";
            if ([".mp4", ".webm", ".mov"].includes(ext)) {
              mediaType = "video";
            }
            if ([".mp3", ".wav"].includes(ext)) {
              mediaType = "audio";
            }

            const newMedia: AddMediaRequest = {
              mediaSourceId: validatedSourceId,
              filePath: relativePath,
              fileName: path.basename(file),
              mediaType,
              width: metadata.width,
              height: metadata.height,
              fileSize: metadata.size,
              createdAt: metadata.createdAt,
              modifiedAt: metadata.modifiedAt,
              description: null,
            };

            const created = await this.mediaRepository.create(newMedia);
            newMediaItems.push({ id: created.id, filePath: relativePath });
          } catch (_e) {
            // Ignore creation errors
          }
        }
      } catch (_e) {
        // Ignore finding errors
      }
    }

    if (newMediaItems.length > 0) {
      const jobs = newMediaItems.map((item) => ({
        mediaId: item.id,
        sourcePath: directoryPath,
        type: "thumbnail" as const,
      }));

      addJobsToQueue(validatedSourceId, jobs);
      startJobQueue(validatedSourceId, (job) =>
        processMediaJob(job, validatedSourceId)
      );
    }
  }

  /**
   * Retrieves all media for a source.
   */
  async getAllMedia(mediaSourceId: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    return await this.mediaRepository.findAllBySourceId(validatedSourceId);
  }

  /**
   * Retrieves a single media item.
   */
  async getMedia(mediaSourceId: string, mediaId: string) {
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

  /**
   * Updates a media item.
   */
  async updateMedia(
    mediaSourceId: string,
    mediaId: string,
    updates: unknown,
    tx?: Transaction
  ) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);
    const parsedUpdates = updateMediaRequestSchema.parse(updates);

    const execute = async (t: Transaction) => {
      const media = await this.mediaRepository.findById(validatedMediaId, t);
      if (!media || media.mediaSourceId !== validatedSourceId) {
        throw new ResourceNotFoundError("Media", validatedMediaId);
      }

      const updatedMedia = await this.mediaRepository.update(
        validatedMediaId,
        parsedUpdates,
        t
      );

      if (parsedUpdates.sourceUrls?.length) {
        const existingUrls = await this.mediaRepository.getUrls(
          validatedMediaId,
          t
        );
        const existingUrlSet = new Set(existingUrls.map((u) => u.url));
        const newUrls = parsedUpdates.sourceUrls.filter(
          (u) => !existingUrlSet.has(u)
        );
        if (newUrls.length > 0) {
          await this.mediaRepository.addUrls(validatedMediaId, newUrls, t);
        }
      }

      if (parsedUpdates.authors?.length) {
        const { AuthorRepository } = await import(
          "~/infrastructure/repositories/author-repository"
        );
        for (const authorData of parsedUpdates.authors) {
          const author = await AuthorRepository.create(
            {
              name: authorData.name,
              accountId: authorData.accountId || null,
            },
            t
          );
          await AuthorRepository.addMedia(validatedMediaId, author.id, t);
        }
      }

      return updatedMedia;
    };

    if (tx) {
      return await execute(tx);
    }
    return await DrizzleTransactionManager.transaction(execute);
  }

  /**
   * Retrieves tags for a media item.
   */
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

  /**
   * Retrieves metadata (generation info) for a media item.
   */
  async getMediaMetadata(mediaSourceId: string, mediaId: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await this.mediaRepository.findById(validatedMediaId);
    if (!media) {
      throw new ResourceNotFoundError("Media", validatedMediaId);
    }
    if (media.mediaSourceId !== validatedSourceId) {
      throw new ResourceNotFoundError("Media not found in source");
    }

    const generationInfo =
      await this.mediaRepository.getGenerationInfo(validatedMediaId);
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

  /**
   * Copies a media item to another source.
   */
  async copyMedia(
    sourceMediaId: string,
    targetSourceId: string,
    tx?: Transaction
  ): Promise<{ success: boolean; media: Media }> {
    const validatedSourceMediaId = mediaIdSchema.parse(sourceMediaId);
    const validatedTargetSourceId = mediaSourceIdSchema.parse(targetSourceId);

    // 1. Get Source Media and Source Info
    const sourceMedia = await this.mediaRepository.findById(
      validatedSourceMediaId,
      tx
    );
    if (!sourceMedia) {
      throw new ResourceNotFoundError("Source Media", validatedSourceMediaId);
    }

    // Get source media metadata (authors, URLs)
    const [sourceAuthors, sourceUrls] = await Promise.all([
      this.mediaRepository.getAuthors(validatedSourceMediaId, tx),
      this.mediaRepository.getUrls(validatedSourceMediaId, tx),
    ]);

    const sourceSource = await this.sourceRepository.findById(
      sourceMedia.mediaSourceId,
      tx
    );
    const targetSource = await this.sourceRepository.findById(
      validatedTargetSourceId,
      tx
    );

    if (!(sourceSource && targetSource)) {
      throw new Error("Source or target media source not found.");
    }

    // 2. Validate Local-to-Local (Phase 1 Limitation)
    if (sourceSource.type !== "local" || targetSource.type !== "local") {
      throw new Error("Only local-to-local copy is supported in this version.");
    }

    const sourceConnection = sourceSource.connectionInfo as { path: string };
    const targetConnection = targetSource.connectionInfo as { path: string };
    const fullSourcePath = path.join(
      sourceConnection.path,
      sourceMedia.filePath
    );

    // 3. Perform Physical Copy
    const fileInfo = await this.storageService.copyFile(
      fullSourcePath,
      targetConnection.path,
      {
        filename: sourceMedia.fileName,
        autoIncrement: true,
      }
    );

    // 4. Create New Media Entry in DB
    const newMedia: AddMediaRequest = {
      mediaSourceId: validatedTargetSourceId,
      filePath: fileInfo.filePath,
      fileName: fileInfo.fileName,
      mediaType: sourceMedia.mediaType,
      width: fileInfo.width,
      height: fileInfo.height,
      fileSize: fileInfo.size,
      description: sourceMedia.description,
      // Preserve original dates instead of using new file timestamps
      createdAt: sourceMedia.createdAt,
      modifiedAt: sourceMedia.modifiedAt,
    };

    const newMediaEntry = await this.mediaRepository.create(newMedia, tx);

    // 4.1. Copy Authors
    if (sourceAuthors.length > 0) {
      const { AuthorRepository } = await import(
        "~/infrastructure/repositories/author-repository"
      );
      for (const author of sourceAuthors) {
        // Create or get existing author
        const newAuthor = await AuthorRepository.create(
          {
            name: author.name,
            accountId: author.accountId,
          },
          tx
        );
        // Link to new media
        await AuthorRepository.addMedia(newMediaEntry.id, newAuthor.id, tx);
      }
    }

    // 4.2. Copy URLs
    if (sourceUrls.length > 0) {
      await this.mediaRepository.addUrls(
        newMediaEntry.id,
        sourceUrls.map((u) => u.url),
        tx
      );
    }

    // 5. Start Thumbnail Generation for New Media
    const sourcePath = targetConnection.path;
    await addJobsToQueue(validatedTargetSourceId, [
      {
        mediaId: newMediaEntry.id,
        sourcePath,
        type: "thumbnail",
      },
    ]);
    startJobQueue(validatedTargetSourceId, (job) =>
      processMediaJob(job, validatedTargetSourceId)
    );

    // Notify via SSE
    SseManager.notifyMediaCopied(
      sourceMediaId,
      validatedTargetSourceId,
      newMediaEntry
    );

    return {
      success: true,
      media: newMediaEntry,
    };
  }

  /**
   * Moves a media item to another source (Copy + Delete).
   */
  async moveMedia(
    sourceMediaId: string,
    targetSourceId: string,
    tx?: Transaction
  ): Promise<{ success: boolean; media: Media }> {
    const execute = async (t: Transaction) => {
      // 1. Copy
      const result = await this.copyMedia(sourceMediaId, targetSourceId, t);

      // 2. Delete Original if Copy Successful
      if (result.success) {
        const sourceMedia = await this.mediaRepository.findById(
          sourceMediaId,
          t
        );
        if (sourceMedia) {
          await this.deleteMedia(sourceMedia.mediaSourceId, sourceMediaId, t);

          // Notify via SSE
          SseManager.notifyMediaMoved(
            sourceMedia.mediaSourceId,
            targetSourceId,
            sourceMediaId,
            result.media
          );
        }
      }
      return result;
    };

    if (tx) {
      return await execute(tx);
    }
    return await DrizzleTransactionManager.transaction(execute);
  }

  /**
   * Deletes a media item.
   */
  async deleteMedia(
    mediaSourceId: string,
    mediaId: string,
    tx?: Transaction
  ): Promise<void> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await this.mediaRepository.findById(validatedMediaId, tx);
    if (!media) {
      throw new ResourceNotFoundError("Media", validatedMediaId);
    }
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not in specified source");
    }

    // 1. Delete thumbnail
    await deleteThumbnail(validatedSourceId, validatedMediaId);

    // 2. Delete from database
    await this.mediaRepository.delete(validatedMediaId, tx);

    // 3. Delete file from filesystem
    if (media.mediaSourceId) {
      const mediaSource = await this.sourceRepository.findById(
        media.mediaSourceId,
        tx
      );
      if (mediaSource && mediaSource.type === "local") {
        const connectionInfo = mediaSource.connectionInfo as { path: string };
        try {
          await this.storageService.deleteFile(
            connectionInfo.path,
            media.filePath
          );
        } catch (_e) {
          // Log error
        }
      }
    }

    // Notify via SSE
    SseManager.sendEvent(validatedSourceId, "media-deleted", {
      filePath: media.filePath,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Helper to lazy-extract metadata for local files if missing.
   */
  private async extractAndUpdateMetadata(
    media: Media,
    sourceId: string
  ): Promise<MediaGenerationInfo | null> {
    const mediaSource = await this.sourceRepository.findById(sourceId);
    if (!mediaSource || mediaSource.type !== "local") {
      return null;
    }

    const connectionInfo = mediaSource.connectionInfo as { path: string };
    const fullPath = path.join(connectionInfo.path, media.filePath);

    try {
      const metadata = await this.imageProcessor.extractMetadata(fullPath);

      // Store generation info
      await this.mediaRepository.upsertGenerationInfo(
        media.id,
        typeof metadata.prompt === "object"
          ? JSON.stringify(metadata.prompt)
          : (metadata.prompt as string | null),
        metadata.workflow as object | null
      );

      // Store tags
      if (metadata.tags.length > 0) {
        await this.tagRepository.addTagsToMedia(
          media.id,
          metadata.tags,
          "comfyui_workflow"
        );
      }

      return await this.mediaRepository.getGenerationInfo(media.id);
    } catch (_e) {
      return null;
    }
  }
}

// Export a default instance for backward compatibility
export const MediaService = new MediaServiceImpl(
  services.getMediaRepository(),
  services.getSourceRepository(),
  services.getStorageService(),
  services.getTagRepository(),
  services.getImageProcessor()
);
