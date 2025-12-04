import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { z } from "zod";
import {
  type MediaSearchRequest,
  type MediaSearchResponse,
  mediaSearchResponseSchema,
} from "~/domain/media/schemas";
import type { conflictSchema } from "~/domain/media/upload-schemas";
import {
  deleteMedia as dbDeleteMedia,
  updateMedia as dbUpdateMedia,
  insertMedia,
  selectMediaById,
  selectMediaBySourceId,
  selectMediaBySourceIdAndDirectoryPath,
  selectMediaBySourceIdAndFilePath,
} from "~/infrastructure/db/queries/media";
import { selectAuthorsByMediaId } from "~/infrastructure/db/queries/media-authors";
import { selectMediaGenerationInfoById } from "~/infrastructure/db/queries/media-generation-info";
import { selectMediaUrlsByMediaId } from "~/infrastructure/db/queries/media-urls";
import {
  searchMediaInDirectory,
  searchMedia as searchMediaQuery,
} from "~/infrastructure/db/queries/search";
import { selectMediaTagsByMediaId } from "~/infrastructure/db/queries/tags";
import type { Media, NewMedia, Tag } from "~/infrastructure/db/schema";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { NotFoundError } from "../db/errors";

export const MediaRepository = {
  /**
   * Retrieves a specific media item by its ID.
   */
  async findById(mediaId: string): Promise<Media> {
    return await selectMediaById(mediaId);
  },

  /**
   * Retrieves a specific media item by Source ID and File Path.
   */
  async findBySourceAndPath(
    mediaSourceId: string,
    filePath: string
  ): Promise<Media[]> {
    return await selectMediaBySourceIdAndFilePath(mediaSourceId, filePath);
  },

  /**
   * Creates a new media entry in the database.
   */
  async create(media: NewMedia): Promise<Media> {
    return await insertMedia(media);
  },

  /**
   * Updates an existing media entry.
   */
  async update(mediaId: string, updates: Partial<Media>): Promise<Media> {
    return await dbUpdateMedia(mediaId, updates);
  },

  /**
   * Deletes a media entry from the database.
   */
  async delete(mediaId: string): Promise<void> {
    await dbDeleteMedia(mediaId);
  },

  /**
   * Searches for media based on criteria.
   */
  async search(
    mediaSourceId: string,
    params: MediaSearchRequest
  ): Promise<MediaSearchResponse> {
    const tagsArray = params.tags
      ? params.tags.split(",").map((t: string) => t.trim())
      : undefined;
    const excludeTagsArray = params.excludeTags
      ? params.excludeTags.split(",").map((t: string) => t.trim())
      : undefined;
    const projectsArray = params.projects
      ? params.projects
          .split(",")
          .map((p: string) => Number.parseInt(p.trim(), 10))
      : undefined;
    const ipsArray = params.ips
      ? params.ips.split(",").map((i: string) => Number.parseInt(i.trim(), 10))
      : undefined;
    const charactersArray = params.characters
      ? params.characters
          .split(",")
          .map((c: string) => Number.parseInt(c.trim(), 10))
      : undefined;

    const result = await searchMediaQuery(mediaSourceId, {
      query: params.q,
      tags: tagsArray,
      tagMode: params.tagMode,
      excludeTags: excludeTagsArray,
      projects: projectsArray,
      ips: ipsArray,
      characters: charactersArray,
      sort: params.sort,
      order: params.order,
      limit: params.limit,
      offset: params.offset,
    });

    return mediaSearchResponseSchema.parse(result);
  },

  /**
   * Lists media in a directory.
   */
  async listByDirectory(
    mediaSourceId: string,
    directoryPath: string
  ): Promise<Media[]> {
    return await selectMediaBySourceIdAndDirectoryPath(
      mediaSourceId,
      directoryPath
    );
  },

  /**
   * Searches for media in a directory.
   */
  async searchInDirectory(
    mediaSourceId: string,
    directoryPath: string,
    params: { query?: string; tags?: string[] }
  ): Promise<Media[]> {
    return await searchMediaInDirectory(mediaSourceId, directoryPath, params);
  },

  /**
   * Retrieves all media for a source.
   */
  async findAllBySourceId(mediaSourceId: string): Promise<Media[]> {
    return await selectMediaBySourceId(mediaSourceId);
  },

  /**
   * Retrieves tags for a media item.
   */
  async getTags(
    mediaId: string
  ): Promise<(Tag & { type: "positive" | "negative" })[]> {
    return await selectMediaTagsByMediaId(mediaId);
  },

  /**
   * Retrieves generation info for a media item.
   */
  async getGenerationInfo(mediaId: string) {
    return await selectMediaGenerationInfoById(mediaId).catch((error) => {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    });
  },

  /**
   * Retrieves authors for a media item.
   */
  async getAuthors(mediaId: string) {
    return await selectAuthorsByMediaId(mediaId);
  },

  /**
   * Retrieves source URLs for a media item.
   */
  async getUrls(mediaId: string) {
    return await selectMediaUrlsByMediaId(mediaId);
  },

  /**
   * Saves a file to the filesystem and returns metadata.
   * Does NOT insert into DB.
   */
  async saveFile(
    basePath: string,
    file: File,
    options: {
      filename?: string;
      overwrite?: boolean;
      autoIncrement?: boolean;
    }
  ): Promise<{
    filePath: string;
    fileName: string;
    width: number;
    height: number;
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    conflict?: z.infer<typeof conflictSchema>;
  }> {
    const uploadRequest = options;
    let targetFileName = uploadRequest.filename || file.name;
    let targetFilePath = path.join(basePath, targetFileName);
    let relativeFilePath = path.relative(basePath, targetFilePath);
    let conflict: z.infer<typeof conflictSchema> | undefined;

    // Handle file name conflicts
    let counter = 0;
    while (
      await fs
        .stat(targetFilePath)
        .then(() => true)
        .catch(() => false)
    ) {
      if (uploadRequest.overwrite) {
        break; // Overwrite existing file
      }

      if (!uploadRequest.autoIncrement) {
        conflict = {
          existingFile: relativeFilePath,
          suggestedName: "",
        };
        throw new Error("File already exists and overwrite is not allowed.");
      }

      counter++;
      const ext = path.extname(file.name);
      const base = path.basename(file.name, ext);
      targetFileName = `${base}_${counter}${ext}`;
      targetFilePath = path.join(basePath, targetFileName);
      relativeFilePath = path.relative(basePath, targetFilePath);
      conflict = {
        existingFile: path.relative(
          basePath,
          path.join(basePath, uploadRequest.filename || file.name)
        ),
        suggestedName: targetFileName,
      };
    }

    // Save the file
    await fs.writeFile(targetFilePath, Buffer.from(await file.arrayBuffer()));

    // Extract metadata
    const stats = await fs.stat(targetFilePath);
    const metadata = await sharp(targetFilePath).metadata();

    if (!(metadata.width && metadata.height)) {
      await fs.unlink(targetFilePath); // Clean up if metadata extraction fails
      throw new Error("Could not extract media dimensions.");
    }

    return {
      filePath: relativeFilePath,
      fileName: targetFileName,
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      conflict,
    };
  },

  /**
   * Scans a directory for media files.
   * Uses an iterative approach to avoid stack overflow.
   */
  async scanDirectory(basePath: string): Promise<string[]> {
    const files: string[] = [];
    const queue: string[] = [basePath];

    while (queue.length > 0) {
      const dir = queue.shift();
      if (!dir) {
        continue;
      }

      try {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
          const res = path.resolve(dir, dirent.name);
          if (dirent.isDirectory()) {
            queue.push(res);
          } else {
            files.push(res);
          }
        }
      } catch (_e) {
        // Ignore errors for individual directories to allow partial scanning
        // In the future, this should be logged
      }
    }

    return files;
  },

  /**
   * Extracts metadata from a file on disk.
   */
  async extractMetadataFromFile(
    fullPath: string,
    mediaId: string
  ): Promise<void> {
    await ImageProcessor.extractMetadata(fullPath, mediaId);
  },

  /**
   * Gets basic file metadata (size, dimensions) for a file on disk.
   */
  async getFileMetadata(filePath: string) {
    const stats = await fs.stat(filePath);
    const metadata = await sharp(filePath).metadata();

    if (!(metadata.width && metadata.height)) {
      throw new Error(`Could not extract media dimensions for ${filePath}`);
    }

    return {
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  },
};
