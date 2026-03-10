/**
 * MediaService Interface Class
 * Refactored to allow Dependency Injection
 */

import path from "node:path";
import type { IMediaStorage } from "@solid-imager/core";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
  type AddMediaRequest,
  type Media,
  type MediaDetails,
  type MediaGenerationInfo,
  mediaIdSchema,
  mediaSearchRequestSchema,
  mediaSourceIdSchema,
  updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
  type UploadMediaRequest,
  type UploadResponse,
  uploadMediaRequestSchema,
} from "@solid-imager/core/domain/media/upload-schemas";
import {
  getContentTypeFromExtension,
  getMediaTypeFromExtension,
} from "@solid-imager/core/domain/media/utils/media-type-utils";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository"; // Added
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import { services } from "~/application/registry"; // Default registry
import {
  type DeferredActions,
  type DeferredSse,
  executeDeferredActions,
} from "~/application/services/job-dispatch-service";
import type { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
// import { SseManager } from "~/infrastructure/jobs/sse-manager";
// keeping SseManager if used elsewhere
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

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
  private readonly storageService: IMediaStorage;
  private readonly tagRepository: TagRepositoryDef;
  private readonly imageProcessor: IImageProcessor;
  private readonly authorRepository: IAuthorRepository;
  private readonly projectRepository: IProjectRepository;
  private readonly characterRepository: CharacterRepository;
  private readonly ipRepository: IIpRepository;
  private readonly mediaProcessingService: MediaProcessingServiceImpl;
  // biome-ignore lint/nursery/useMaxParams: Dependency injection
  constructor(
    mediaRepository: IMediaRepository,
    sourceRepository: SourceRepository,
    storageService: IMediaStorage,
    tagRepository: TagRepositoryDef,
    imageProcessor: IImageProcessor,
    authorRepository: IAuthorRepository,
    projectRepository: IProjectRepository,
    characterRepository: CharacterRepository,
    ipRepository: IIpRepository,
    mediaProcessingService: MediaProcessingServiceImpl
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
    this.mediaProcessingService = mediaProcessingService;
  }

  /**
   * Starts processing jobs for the given source using the unified processor.
   * @deprecated Worker now handles this automatically.
   */
  startProcessing(_mediaSourceId: string) {
    // No-op: JobWorker is handling this globally.
  }

  // biome-ignore lint/suspicious/noExplicitAny: Breaking circular type dependency for remote client
  private async _createRemoteClient(targetServerId: string): Promise<any> {
    const config = services.getConfigService().getConfig();
    const targetServer = config.sync.servers.find(
      (s) => s.id === targetServerId
    );

    if (!targetServer) {
      throw new Error(`Target server with ID ${targetServerId} not found`);
    }

    // Basic SSRF protection: Ensure the URL is valid and uses http(s)
    let remoteUrl: URL;
    const baseUrl = targetServer.url.endsWith("/")
      ? targetServer.url
      : `${targetServer.url}/`;
    try {
      remoteUrl = new URL("api/rpc", baseUrl);
    } catch {
      throw new Error(`Invalid remote server URL: ${targetServer.url}`);
    }

    if (remoteUrl.protocol !== "http:" && remoteUrl.protocol !== "https:") {
      throw new Error(
        "Only HTTP and HTTPS protocols are allowed for remote sync."
      );
    }

    // Optional: Disallow localhost/127.0.0.1 if strict SSRF protection is needed.
    // For personal media server, local networking might be intentional, but let's
    // at least ensure it's not trying to hit the exact same server instance in an infinite loop
    // This is hard to do without knowing our own address, so we just check protocols.

    const { createORPCClient } = await import("@orpc/client");
    const { RPCLink } = await import("@orpc/client/fetch");

    const link = new RPCLink({
      url: remoteUrl.toString(),
      // biome-ignore lint/suspicious/noExplicitAny: RPCLink fetch init has restrictive types
      fetch: (input, init: any) => {
        const headers = new Headers(init?.headers);
        if (targetServer.apiKey) {
          headers.set("Authorization", `Bearer ${targetServer.apiKey}`);
        }
        return fetch(input, { ...init, headers });
      },
    });

    // biome-ignore lint/suspicious/noExplicitAny: Using any to avoid complex circular type inference
    return createORPCClient<any>(link);
  }

  /**
   * Gets sources from a remote server.
   */
  // biome-ignore lint/suspicious/noExplicitAny: Remote sources can have varying structures
  async getRemoteSources(targetServerId: string): Promise<any> {
    const remoteClient = await this._createRemoteClient(targetServerId);
    try {
      return await remoteClient.sources.list();
    } catch (error) {
      throw new Error(
        `Failed to fetch remote sources: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Sync a media item to a remote server.
   */
  async syncMediaToRemote(
    mediaSourceId: string,
    mediaId: string,
    targetServerId: string,
    targetSourceId: string
    // biome-ignore lint/suspicious/noExplicitAny: Upload result structure may vary
  ): Promise<any> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    // 1. Get media details
    const mediaDetails = await this.getMediaDetails(
      validatedSourceId,
      validatedMediaId
    );

    // 2. Setup ORPC client for remote server
    const remoteClient = await this._createRemoteClient(targetServerId);

    // 3. Get File path and create a stream to avoid memory exhaustion
    const mediaSource = await this.sourceRepository.findById(validatedSourceId);
    if (!mediaSource || mediaSource.type !== "local") {
      throw new Error(
        "Only local media sources are supported for sync source."
      );
    }
    const connectionInfo = mediaSource.connectionInfo as { path: string };
    const filePath = this.storageService.getFilePath(
      connectionInfo.path,
      mediaDetails.filePath
    );

    try {
      // 4. Upload File using native fetch to support streaming the file body
      const sourceUrl = mediaDetails.urls?.[0]?.url;

      const { openAsBlob } = await import("node:fs");
      const fileBlob = await openAsBlob(filePath);

      const formData = new FormData();
      formData.append("sourceId", targetSourceId);
      formData.append("file", fileBlob, mediaDetails.fileName);
      if (mediaDetails.fileName) {
        formData.append("filename", mediaDetails.fileName);
      }
      if (mediaDetails.description) {
        formData.append("description", mediaDetails.description);
      }
      if (sourceUrl) {
        formData.append("sourceUrl", sourceUrl);
      }
      formData.append("overwrite", "true");

      const targetServer = services
        .getConfigService()
        .getConfig()
        .sync.servers.find((s) => s.id === targetServerId);
      if (!targetServer) {
        throw new Error("Target server not found");
      }

      // Call the remote REST endpoint directly to allow multipart/form-data streaming
      const uploadUrl = new URL("/api/rpc/media.upload", targetServer.url);
      const headers: Record<string, string> = {};
      if (targetServer.apiKey) {
        headers.Authorization = `Bearer ${targetServer.apiKey}`;
      }

      const response = await fetch(uploadUrl.toString(), {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.statusText} - ${text}`);
      }

      const uploadResult = await response.json();
      // Ensure we unwrap the data from ORPC response
      const remoteMediaId =
        uploadResult?.data?.mediaId || uploadResult?.mediaId;

      if (remoteMediaId) {
        // 5. Update Metadata using the reliable mediaId
        await remoteClient.media.update({
          sourceId: targetSourceId,
          mediaId: remoteMediaId,
          data: {
            description: mediaDetails.description,
            sourceUrls: mediaDetails.urls.map((u) => u.url),
            authors: mediaDetails.authors.map((a) => ({
              name: a.name,
              accountId: a.accountId,
            })),
            characters: mediaDetails.characters.map((c) => ({
              name: c.name,
              confidence: c.confidence,
            })),
            ips: mediaDetails.ips.map((i) => ({
              name: i.name,
              confidence: i.confidence,
            })),
          },
        });
      }

      return {
        success: true,
        message: "Media uploaded and metadata synced successfully.",
      };
    } catch (error) {
      throw new Error(
        `Failed to sync to remote server: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Searches for media.
   */
  async searchMedia(mediaSourceId: string | undefined | null, params: unknown) {
    const searchRequest = mediaSearchRequestSchema.parse(params);
    if (mediaSourceId) {
      const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
      return await this.mediaRepository.search(
        validatedSourceId,
        searchRequest
      );
    }
    return await this.mediaRepository.globalSearch(searchRequest);
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

    // 4. Trigger processMedia Job (unified processing)
    // 4. Trigger processMedia Job (unified processing)
    const jobRepo = services.getJobRepository();
    await jobRepo.create({
      type: "processMedia",
      mediaSourceId: validatedSourceId,
      payload: {
        mediaId: insertedMedia.id,
        sourcePath: basePath,
        type: "processMedia",
      },
    });

    this.startProcessing(validatedSourceId);

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

    const mediaDetails =
      await this.mediaRepository.getDetails(validatedMediaId);
    if (!mediaDetails) {
      throw new ResourceNotFoundError("Media", validatedMediaId);
    }
    if (mediaDetails.mediaSourceId !== validatedSourceId) {
      throw new ResourceNotFoundError("Media not found in source");
    }

    let finalGenerationInfo = mediaDetails.generationInfo;

    // If generation info is not found, try to extract it (Lazy Extraction)
    if (!finalGenerationInfo) {
      finalGenerationInfo = await this.extractAndUpdateMetadata(
        mediaDetails,
        validatedSourceId
      );
    }

    return {
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
      // Use processMedia job type for unified processing
      const jobRepo = services.getJobRepository();

      for (const item of newMediaItems) {
        await jobRepo.create({
          type: "processMedia",
          mediaSourceId: validatedSourceId,
          payload: {
            mediaId: item.id,
            sourcePath: directoryPath,
            type: "processMedia",
          },
        });
      }

      // this.startProcessing(validatedSourceId);
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

      const [updatedMedia] = await Promise.all([
        this.mediaRepository.update(validatedMediaId, parsedUpdates, t),
        this.mediaProcessingService.addContextMetadataToExistingMedia(
          validatedMediaId,
          {
            sourceUrls: parsedUpdates.sourceUrls,
            authors: parsedUpdates.authors,
            characters: parsedUpdates.characters,
            ips: parsedUpdates.ips,
          },
          t
        ),
      ]);

      return updatedMedia;
    };

    if (tx) {
      return await execute(tx);
    }
    return await DrizzleTransactionManager.transaction(execute);
  }

  /**
   * Reprocesses media metadata (extracts generation info and tags).
   */
  async reprocessMetadata(mediaSourceId: string, mediaId: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await this.mediaRepository.findById(validatedMediaId);
    if (!media || media.mediaSourceId !== validatedSourceId) {
      throw new ResourceNotFoundError("Media", validatedMediaId);
    }

    return await this.extractAndUpdateMetadata(media, validatedSourceId);
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
  ): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
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

    // 5. Prepare Deferred Actions (Jobs + Notifications)
    const sourcePath = targetConnection.path;
    // Construct DB Job DTO (DeferredJob)
    const deferredJob: import("~/application/services/job-dispatch-service").DeferredJob =
      {
        mediaId: newMediaEntry.id,
        sourcePath,
        type: "processMedia",
        payload: {
          mediaId: newMediaEntry.id,
          sourcePath,
          type: "processMedia",
        },
      };

    const deferredActions: DeferredActions = {
      jobs: [
        {
          mediaSourceId: validatedTargetSourceId,
          jobs: [deferredJob],
        },
      ],
      sse: [], // Will be handled differently if no tx
    };

    // Note: notifyMediaCopied is a static helper that might not fit easily into DeferredSse structure
    // without duplicating its logic. SseManager.notifyMediaCopied sends "media-copied".
    // Let's replicate the event structure.
    const sseEvent: DeferredSse = {
      mediaSourceId: validatedTargetSourceId,
      event: "media-copied",
      payload: {
        sourceMediaId,
        media: newMediaEntry,
        timestamp: new Date().toISOString(),
      },
    };

    if (tx) {
      deferredActions.sse.push(sseEvent);
      return {
        success: true,
        media: newMediaEntry,
        deferred: deferredActions,
      };
    }

    // Execute immediately if no transaction
    // Execute immediately if no transaction
    // addJobsToQueue(validatedTargetSourceId, jobs);
    // this.startProcessing(validatedTargetSourceId);
    // Use executeDeferredActions implementation logic directly or call it?
    // Since we returned a deferred action object in other branch, here we should arguably EXECUTE it.
    // Or just invoke jobRepo directly.

    // Note: jobs type was old Job[], now deferredJob is DeferredJob.
    // Let's use jobRepo directly.
    const jobRepo = services.getJobRepository();
    await jobRepo.create({
      type: "processMedia",
      mediaSourceId: validatedTargetSourceId,
      payload: {
        mediaId: newMediaEntry.id,
        sourcePath,
        type: "processMedia",
      },
    });

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
  ): Promise<{ success: boolean; media: Media; deferred?: DeferredActions }> {
    const execute = async (t: Transaction) => {
      const accumulatedDeferred: DeferredActions = {
        jobs: [],
        sse: [],
      };

      // 1. Copy
      const copyResult = await this.copyMedia(sourceMediaId, targetSourceId, t);
      if (copyResult.deferred) {
        accumulatedDeferred.jobs.push(...copyResult.deferred.jobs);
        // We omit individual media-copied event for move context
      }

      // 2. Delete Original if Copy Successful
      if (copyResult.success) {
        const sourceMedia = await this.mediaRepository.findById(
          sourceMediaId,
          t
        );
        if (sourceMedia) {
          const deleteResult = await this.deleteMedia(
            sourceMedia.mediaSourceId,
            sourceMediaId,
            t
          );
          if (deleteResult) {
            accumulatedDeferred.jobs.push(...deleteResult.jobs);
            // We omit individual media-deleted event for move context
          }

          // Replicate SseManager.notifyMediaMoved logic but deferred
          const sseEventSource: DeferredSse = {
            mediaSourceId: sourceMedia.mediaSourceId,
            event: "media-moved",
            payload: {
              type: "source",
              mediaId: sourceMediaId,
              targetId: targetSourceId,
              timestamp: new Date().toISOString(),
            },
          };
          const sseEventTarget: DeferredSse = {
            mediaSourceId: targetSourceId,
            event: "media-moved",
            payload: {
              type: "target",
              media: copyResult.media,
              sourceId: sourceMedia.mediaSourceId,
              timestamp: new Date().toISOString(),
            },
          };
          accumulatedDeferred.sse.push(sseEventSource, sseEventTarget);
        }
      }
      return {
        ...copyResult,
        deferred: accumulatedDeferred,
      };
    };

    if (tx) {
      return await execute(tx);
    }

    // Top-level transaction
    const result = await DrizzleTransactionManager.transaction(execute);

    // Execute deferred actions after commit
    if (result.deferred) {
      executeDeferredActions(result.deferred);
    }

    return result;
  }

  /**
   * Deletes a media item.
   */
  async deleteMedia(
    mediaSourceId: string,
    mediaId: string,
    tx?: Transaction
  ): Promise<DeferredActions | undefined> {
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

    // Prepare Deferred Notification
    const sseEvent: DeferredSse = {
      mediaSourceId: validatedSourceId,
      event: "media-deleted",
      payload: {
        filePath: media.filePath,
        timestamp: new Date().toISOString(),
      },
    };

    if (tx) {
      return {
        jobs: [],
        sse: [sseEvent],
      };
    }

    // Notify via SSE immediately
    SseManager.sendEvent(
      sseEvent.mediaSourceId,
      sseEvent.event,
      sseEvent.payload
    );
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
        sourceCharacters.map((c) => ({ id: c.id })),
        "manual", // source
        tx
      );
    }

    // 4. IPs
    const sourceIps = await this.ipRepository.findByMediaId(sourceMediaId, tx);
    if (sourceIps.length > 0) {
      await this.ipRepository.addMediaBulk(
        newMediaId,
        sourceIps.map((i) => ({ id: i.id })),
        "manual", // source
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

      logger.info(
        {
          mediaId: media.id,
          fullPath,
          tagsCount: metadata.tags.length,
          hasWorkflow: !!metadata.workflow,
          hasPrompt: !!metadata.prompt,
        },
        "[MediaService] extractAndUpdateMetadata result"
      );

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
    } catch (e) {
      logger.error(
        { err: e, mediaId: media.id, fullPath },
        "[MediaService] extractAndUpdateMetadata FAILED"
      );
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
      services.getMediaStorage(),
      services.getTagRepository(),
      services.getImageProcessor(),
      services.getAuthorRepository(),
      services.getProjectRepository(),
      services.getCharacterRepository(),
      services.getIpRepository(),
      services.getMediaProcessingService()
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
