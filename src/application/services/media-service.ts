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
  type UploadMediaRequest,
  type UploadResponse,
  uploadMediaRequestSchema,
} from "~/domain/media/upload-schemas";
import {
  getContentTypeFromExtension,
  getMediaTypeFromExtension,
} from "~/domain/media/utils/media-type-utils";
import type { IAuthorRepository } from "~/domain/repositories/author-repository";
import type { CharacterRepository } from "~/domain/repositories/character-repository";
import type { IIpRepository } from "~/domain/repositories/ip-repository";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import type { IProjectRepository } from "~/domain/repositories/project-repository";
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

const SIGNATURES = {
  png: Buffer.from("89504e470d0a1a0a", "hex"),
  jpg: Buffer.from("ffd8ff", "hex"),
  jpeg: Buffer.from("ffd8ff", "hex"),
  gif: Buffer.from("47494638", "hex"),
  webp: Buffer.from("52494646", "hex"), // RIFF
  mp4: Buffer.from("66747970", "hex"), // ftyp
  webm: Buffer.from("1a45dfa3", "hex"),
  mp3: Buffer.from("494433", "hex"), // ID3
  wav: Buffer.from("52494646", "hex"), // RIFF
};

const WEBP_SUBTYPE = Buffer.from("57454250", "hex"); // WEBP
const FILE_HEADER_BYTES = 12;
const WEBP_OFFSET = 8;
const WEBP_END = 12;

export async function validateFileSignature(
  file: File,
  filename: string
): Promise<void> {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  const buffer = await file.slice(0, FILE_HEADER_BYTES).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Basic checks
  if (ext in SIGNATURES) {
    const sig = SIGNATURES[ext as keyof typeof SIGNATURES];
    // Check start signature
    if (sig && !bytes.subarray(0, sig.length).every((b, i) => b === sig[i])) {
      throw new Error(`File signature mismatch for .${ext}`);
    }
  }

  // Extra check for WEBP: RIFF....WEBP
  if (
    ext === "webp" &&
    !bytes
      .subarray(WEBP_OFFSET, WEBP_END)
      .every((b, i) => b === WEBP_SUBTYPE[i])
  ) {
    throw new Error("Invalid WEBP signature (missing WEBP)");
  }
}

export class MediaServiceImpl {
  private readonly mediaRepository: IMediaRepository;
  private readonly sourceRepository: SourceRepository;
  private readonly storageService: IStorageService;
  private readonly tagRepository: TagRepositoryDef;
  private readonly imageProcessor: IImageProcessor;
  private readonly authorRepository: IAuthorRepository;
  private readonly projectRepository: IProjectRepository;
  private readonly characterRepository: CharacterRepository;
  private readonly ipRepository: IIpRepository;

  // biome-ignore lint/nursery/useMaxParams: Dependency injection
  constructor(
    mediaRepository: IMediaRepository,
    sourceRepository: SourceRepository,
    storageService: IStorageService,
    tagRepository: TagRepositoryDef,
    imageProcessor: IImageProcessor,
    authorRepository: IAuthorRepository,
    projectRepository: IProjectRepository,
    characterRepository: CharacterRepository,
    ipRepository: IIpRepository
  ) {
    this.mediaRepository = mediaRepository;
    this.sourceRepository = sourceRepository;
    this.storageService = storageService;
    this.tagRepository = tagRepository;
    this.imageProcessor = imageProcessor;
    this.authorRepository = authorRepository;
    this.projectRepository = projectRepository;
    this.characterRepository = characterRepository;
    this.ipRepository = ipRepository;
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
    options: UploadMediaRequest
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

    const uploadRequest = uploadMediaRequestSchema.parse(options);

    // 0. Validate File Signature
    await validateFileSignature(file, uploadRequest.filename ?? file.name);

    // 1. Save File via StorageService
    const fileInfo = await this.storageService.saveFile(basePath, file, {
      filename: uploadRequest.filename,
      overwrite: uploadRequest.overwrite,
      autoIncrement: uploadRequest.autoIncrement,
    });

    // Determine media type based on extension
    const mediaType = getMediaTypeFromExtension(fileInfo.fileName);

    // 2. Create Media Entry
    const newMedia: AddMediaRequest = {
      mediaSourceId: validatedSourceId,
      filePath: fileInfo.filePath,
      fileName: fileInfo.fileName,
      mediaType,
      description: uploadRequest.description || null,
      width: fileInfo.width,
      height: fileInfo.height,
      fileSize: fileInfo.size,
      createdAt: fileInfo.createdAt,
      modifiedAt: fileInfo.modifiedAt,
    };

    let insertedMedia: Media;
    try {
      insertedMedia = await this.mediaRepository.upsert(newMedia);
    } catch (error) {
      // 3. Rollback: Delete file if DB insertion fails
      try {
        await this.storageService.deleteFile(basePath, fileInfo.filePath);
      } catch (_deleteError) {
        // Ignore rollback error
      }
      throw error;
    }

    // Register URL if present (legacy support for sourceUrl in upload)
    if (uploadRequest.sourceUrl) {
      await this.mediaRepository.addUrls(insertedMedia.id, [
        uploadRequest.sourceUrl,
      ]);
    }

    // 4. Trigger Jobs
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
  /**
   * Retrieves media content (file buffer) and content type.
   */
  async getMediaContent(
    mediaSourceId: string,
    mediaId: string
  ): Promise<{ buffer: Buffer; contentType: string }> {
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
      media.filePath
    );

    const contentType = getContentTypeFromExtension(media.fileName);

    return { buffer, contentType };
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
            const mediaType = getMediaTypeFromExtension(file);

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

            const created = await this.mediaRepository.upsert(newMedia);
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
        for (const authorData of parsedUpdates.authors) {
          const author = await this.authorRepository.create(
            {
              name: authorData.name,
              accountId: authorData.accountId || null,
            },
            t
          );
          await this.authorRepository.addMedia(validatedMediaId, author.id, t);
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

    // 4. Copy Metadata
    await this._copyMediaMetadata(validatedSourceMediaId, newMediaEntry.id, tx);

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
  /**
   * Helper to copy metadata (Authors, Projects, Characters, IPs, URLs)
   */
  private async _copyMediaMetadata(
    sourceMediaId: string,
    newMediaId: string,
    tx: Transaction
  ): Promise<void> {
    // 1. Authors
    const sourceAuthors = await this.mediaRepository.getAuthors(
      sourceMediaId,
      tx
    );
    if (sourceAuthors.length > 0) {
      // Optimization: We assume sourceAuthors are already valid entities in our DB,
      // so we can link them directly without re-checking/creating them.
      await this.authorRepository.addMediaBulk(
        newMediaId,
        sourceAuthors.map((a) => a.id),
        tx
      );
    }

    // 2. Projects
    const sourceProjects = await this.projectRepository.findByMediaId(
      sourceMediaId,
      tx
    );
    if (sourceProjects.length > 0) {
      await this.projectRepository.addMediaBulk(
        newMediaId,
        sourceProjects.map((p) => p.id),
        tx
      );
    }

    // 3. Characters
    const sourceCharacters = await this.characterRepository.findByMediaId(
      sourceMediaId,
      tx
    );
    if (sourceCharacters.length > 0) {
      await this.characterRepository.addToMediaBulk(
        newMediaId,
        sourceCharacters.map((c) => c.id),
        tx
      );
    }

    // 4. IPs
    const sourceIps = await this.ipRepository.findByMediaId(sourceMediaId, tx);
    if (sourceIps.length > 0) {
      await this.ipRepository.addMediaBulk(
        newMediaId,
        sourceIps.map((i) => i.id),
        tx
      );
    }

    // 5. URLs
    const sourceUrls = await this.mediaRepository.getUrls(sourceMediaId, tx);
    if (sourceUrls.length > 0) {
      await this.mediaRepository.addUrls(
        newMediaId,
        sourceUrls.map((u) => u.url),
        tx
      );
    }
  }

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

// For backward compatibility and deferred initialization
let _mediaService: MediaServiceImpl | null = null;

export const resetMediaService = () => {
  _mediaService = null;
};

const getMediaService = () => {
  if (!_mediaService) {
    _mediaService = new MediaServiceImpl(
      services.getMediaRepository(),
      services.getSourceRepository(),
      services.getStorageService(),
      services.getTagRepository(),
      services.getImageProcessor(),
      services.getAuthorRepository(),
      services.getProjectRepository(),
      services.getCharacterRepository(),
      services.getIpRepository()
    );
  }
  return _mediaService;
};

export const MediaService = new Proxy({} as MediaServiceImpl, {
  get(_target, prop) {
    const service = getMediaService();
    const value = service[prop as keyof MediaServiceImpl];
    return typeof value === "function" ? value.bind(service) : value;
  },
});
