/**
 * MediaService - Media Management Service
 */

import path from "node:path";
import {
  type MediaDetails,
  mediaIdSchema,
  mediaSearchRequestSchema,
  mediaSourceIdSchema,
  updateMediaRequestSchema,
} from "~/domain/media/schemas";
import {
  type UploadResponse,
  uploadMediaRequestSchema,
} from "~/domain/media/upload-schemas";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";
import type { NewMedia } from "~/infrastructure/db/schema";
import {
  addJobsToQueue,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";
import {
  deleteThumbnail,
  processMediaJob,
} from "~/infrastructure/jobs/thumbnails";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { getDriver } from "~/infrastructure/storage/factory";

export const MediaService = {
  /**
   * Searches for media.
   */
  async searchMedia(mediaSourceId: string, params: unknown) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const searchRequest = mediaSearchRequestSchema.parse(params);
    return await MediaRepository.search(validatedSourceId, searchRequest);
  },

  /**
   * Searches for media in a directory.
   */
  async searchMediaInDirectory(
    mediaSourceId: string,
    directoryPath: string,
    params: { query?: string; tags?: string[] }
  ) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    return await MediaRepository.searchInDirectory(
      validatedSourceId,
      directoryPath,
      params
    );
  },

  /**
   * Uploads a media file.
   */
  async uploadMedia(
    mediaSourceId: string,
    file: File,
    formData: FormData
  ): Promise<UploadResponse> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const mediaSource = await selectMediaSourceById(validatedSourceId);

    if (!mediaSource) {
      throw new Error("Media source not found.");
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

    // 1. Save File via Repository
    const fileInfo = await MediaRepository.saveFile(basePath, file, {
      filename: uploadRequest.filename,
      overwrite: uploadRequest.overwrite,
      autoIncrement: uploadRequest.autoIncrement,
    });

    // 2. Create Media Entry
    const newMedia: NewMedia = {
      mediaSourceId: validatedSourceId,
      filePath: fileInfo.filePath,
      fileName: fileInfo.fileName,
      mediaType: "image", // TODO: Determine based on file type
      description: uploadRequest.description || "",
      width: fileInfo.width,
      height: fileInfo.height,
      fileSize: fileInfo.size,
      createdAt: fileInfo.createdAt,
      modifiedAt: fileInfo.modifiedAt,
    };

    const insertedMedia = await MediaRepository.create(newMedia);

    // Register URL if present (legacy support for sourceUrl in upload)
    if (uploadRequest.sourceUrl) {
      const { insertMediaUrls } = await import(
        "~/infrastructure/db/queries/media-urls"
      );
      await insertMediaUrls(insertedMedia.id, [uploadRequest.sourceUrl]);
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
  },

  /**
   * Retrieves media details including tags and generation info.
   */
  async getMediaDetails(
    mediaSourceId: string,
    mediaId: string
  ): Promise<MediaDetails> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await MediaRepository.findById(validatedMediaId);
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not found");
    }

    const [tags, generationInfo, authors, urls] = await Promise.all([
      MediaRepository.getTags(validatedMediaId),
      MediaRepository.getGenerationInfo(validatedMediaId),
      MediaRepository.getAuthors(validatedMediaId),
      MediaRepository.getUrls(validatedMediaId),
    ]);

    let finalGenerationInfo = generationInfo;

    // If generation info is not found, try to extract it (Lazy Extraction)
    if (!finalGenerationInfo) {
      const mediaSource = await selectMediaSourceById(validatedSourceId);
      if (mediaSource.type === "local") {
        const connectionInfo = mediaSource.connectionInfo as { path: string };
        const fullPath = path.join(connectionInfo.path, media.filePath);

        try {
          // We use Repository to extract metadata, which calls Infra/ImageProcessor
          await MediaRepository.extractMetadataFromFile(
            fullPath,
            validatedMediaId
          );
          finalGenerationInfo =
            await MediaRepository.getGenerationInfo(validatedMediaId);
        } catch (_e) {
          // Ignore extraction errors
        }
      }
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
  },

  /**
   * Retrieves media content (file buffer).
   */
  async getMediaContent(
    mediaSourceId: string,
    mediaId: string
  ): Promise<Buffer> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const mediaSource = await selectMediaSourceById(validatedSourceId);
    if (!mediaSource) {
      throw new Error("Media source not found");
    }

    const media = await MediaRepository.findById(validatedMediaId);
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not found");
    }

    const driver = getDriver(mediaSource);
    return driver.get(media.filePath);
  },

  /**
   * Deletes media.
   */
  async deleteMedia(mediaSourceId: string, mediaId: string): Promise<void> {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await MediaRepository.findById(validatedMediaId);
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not found");
    }

    await MediaRepository.delete(validatedMediaId);

    // Trigger thumbnail deletion (fire and forget or await?)
    try {
      await deleteThumbnail(validatedSourceId, validatedMediaId);
    } catch (_e) {
      // Ignore thumbnail deletion errors
    }
  },

  /**
   * Registers existing media from a directory.
   */
  async registerExistingMedia(mediaSourceId: string, directoryPath: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const files = await MediaRepository.scanDirectory(directoryPath);
    const newMediaItems: { id: string; filePath: string }[] = [];

    for (const file of files) {
      try {
        const relativePath = path.relative(directoryPath, file);
        const existing = await MediaRepository.findBySourceAndPath(
          validatedSourceId,
          relativePath
        );

        if (existing.length === 0) {
          try {
            const metadata = await MediaRepository.getFileMetadata(file);

            // Simple extension check for media type
            const ext = path.extname(file).toLowerCase();
            let mediaType: "image" | "video" | "audio" = "image";
            if ([".mp4", ".webm", ".mov"].includes(ext)) {
              mediaType = "video";
            }
            if ([".mp3", ".wav"].includes(ext)) {
              mediaType = "audio";
            }

            const newMedia = await MediaRepository.create({
              mediaSourceId: validatedSourceId,
              filePath: relativePath,
              fileName: path.basename(file),
              mediaType,
              width: metadata.width,
              height: metadata.height,
              fileSize: metadata.size,
              createdAt: metadata.createdAt,
              modifiedAt: metadata.modifiedAt,
              indexedAt: new Date(),
            });
            newMediaItems.push({ id: newMedia.id, filePath: relativePath });
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
  },

  /**
   * Retrieves all media for a source.
   */
  async getAllMedia(mediaSourceId: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    return await MediaRepository.findAllBySourceId(validatedSourceId);
  },

  /**
   * Retrieves a single media item.
   */
  async getMedia(mediaSourceId: string, mediaId: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);
    const media = await MediaRepository.findById(validatedMediaId);
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not found");
    }
    return media;
  },

  /**
   * Updates a media item.
   */
  async updateMedia(mediaSourceId: string, mediaId: string, updates: unknown) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);
    const parsedUpdates = updateMediaRequestSchema.parse(updates);

    const media = await MediaRepository.findById(validatedMediaId);
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not found");
    }

    const updatedMedia = await MediaRepository.update(
      validatedMediaId,
      parsedUpdates
    );

    // Update URLs if provided
    if (parsedUpdates.sourceUrls && parsedUpdates.sourceUrls.length > 0) {
      const { insertMediaUrls, selectMediaUrlsByMediaId } = await import(
        "~/infrastructure/db/queries/media-urls"
      );
      // Fetch existing URLs to prevent duplicates
      const existingUrls = await selectMediaUrlsByMediaId(validatedMediaId);
      const existingUrlSet = new Set(existingUrls.map((u) => u.url));
      
      const newUrls = parsedUpdates.sourceUrls.filter(
        (u) => !existingUrlSet.has(u)
      );

      if (newUrls.length > 0) {
        await insertMediaUrls(validatedMediaId, newUrls);
      }
    }

    // Update Authors if provided
    if (parsedUpdates.authors && parsedUpdates.authors.length > 0) {
      const { upsertAuthor } = await import(
        "~/infrastructure/db/queries/authors"
      );
      const { insertMediaAuthor } = await import(
        "~/infrastructure/db/queries/media-authors"
      );

      for (const authorData of parsedUpdates.authors) {
        const author = await upsertAuthor({
          name: authorData.name,
          accountId: authorData.accountId || null,
        });
        // insertMediaAuthor handles conflict by ignoring duplicates
        await insertMediaAuthor(validatedMediaId, author.id);
      }
    }

    return updatedMedia;
  },

  /**
   * Retrieves tags for a media item.
   */
  async getMediaTags(mediaSourceId: string, mediaId: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await MediaRepository.findById(validatedMediaId);
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not found");
    }

    return await MediaRepository.getTags(validatedMediaId);
  },

  /**
   * Retrieves metadata (generation info) for a media item.
   */
  async getMediaMetadata(mediaSourceId: string, mediaId: string) {
    const validatedSourceId = mediaSourceIdSchema.parse(mediaSourceId);
    const validatedMediaId = mediaIdSchema.parse(mediaId);

    const media = await MediaRepository.findById(validatedMediaId);
    if (media.mediaSourceId !== validatedSourceId) {
      throw new Error("Media not found");
    }

    const generationInfo =
      await MediaRepository.getGenerationInfo(validatedMediaId);
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
  },
};
