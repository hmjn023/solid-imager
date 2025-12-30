import {
  type AddMediaRequest,
  type MediaSearchRequest,
  type MediaSearchResponse,
  mediaSearchResponseSchema,
  type UpdateMediaRequest,
} from "~/domain/media/schemas";
import type { IMediaRepository } from "~/domain/repositories/media.repository";
import {
  deleteMedia as dbDeleteMedia,
  updateMedia as dbUpdateMedia,
  insertMedia,
  selectMediaById,
  selectMediaBySourceId,
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
import type {
  Author,
  Media,
  MediaGenerationInfo,
  MediaUrl,
  NewMedia,
  Tag,
} from "~/infrastructure/db/schema";
import { NotFoundError } from "../db/errors";

export const MediaRepository: IMediaRepository = {
  /**
   * Retrieves a specific media item by its ID.
   */
  async findById(mediaId: string): Promise<Media | null> {
    try {
      return await selectMediaById(mediaId);
    } catch (e) {
      if (e instanceof NotFoundError) {
        return null;
      }
      throw e;
    }
  },

  /**
   * Retrieves a specific media item by Source ID and File Path.
   */
  async findByPath(sourceId: string, filePath: string): Promise<Media | null> {
    const results = await selectMediaBySourceIdAndFilePath(sourceId, filePath);
    return results[0] || null;
  },

  /**
   * Creates a new media entry in the database.
   */
  async create(media: AddMediaRequest): Promise<Media> {
    const newMedia: NewMedia = {
      ...media,
      fileSize: media.size,
      status: "active",
      indexedAt: new Date(),
    };
    return await insertMedia(newMedia);
  },

  /**
   * Updates an existing media entry.
   */
  async update(mediaId: string, updates: UpdateMediaRequest): Promise<Media> {
    // updates is validated by Zod at controller/service level.
    // Map domain fields to DB fields
    const dbUpdates: Partial<NewMedia> = {};

    if (updates.filePath !== undefined) {
      dbUpdates.filePath = updates.filePath;
    }
    if (updates.fileName !== undefined) {
      dbUpdates.fileName = updates.fileName;
    }
    if (updates.size !== undefined) {
      dbUpdates.fileSize = updates.size;
    }
    if (updates.mediaType !== undefined) {
      dbUpdates.mediaType = updates.mediaType;
    }
    if (updates.width !== undefined) {
      dbUpdates.width = updates.width;
    }
    if (updates.height !== undefined) {
      dbUpdates.height = updates.height;
    }
    if (updates.description !== undefined) {
      dbUpdates.description = updates.description;
    }
    if (updates.createdAt !== undefined) {
      dbUpdates.createdAt = updates.createdAt;
    }
    if (updates.modifiedAt !== undefined) {
      dbUpdates.modifiedAt = updates.modifiedAt;
    } else {
      dbUpdates.modifiedAt = new Date(); // Always update modifiedAt
    }

    return await dbUpdateMedia(mediaId, dbUpdates);
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
      ? params.projects.split(",").map((p: string) => p.trim())
      : undefined;
    const ipsArray = params.ips
      ? params.ips.split(",").map((i: string) => i.trim())
      : undefined;
    const charactersArray = params.characters
      ? params.characters.split(",").map((c: string) => c.trim())
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

  async getTags(
    mediaId: string
  ): Promise<(Tag & { type: "positive" | "negative" })[]> {
    return await selectMediaTagsByMediaId(mediaId);
  },

  async getGenerationInfo(
    mediaId: string
  ): Promise<MediaGenerationInfo | null> {
    return await selectMediaGenerationInfoById(mediaId).catch((error) => {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    });
  },

  async getAuthors(mediaId: string): Promise<Author[]> {
    return await selectAuthorsByMediaId(mediaId);
  },

  async getUrls(mediaId: string): Promise<MediaUrl[]> {
    return await selectMediaUrlsByMediaId(mediaId);
  },

  // Bulk
  async findAllBySourceId(mediaSourceId: string): Promise<Media[]> {
    return await selectMediaBySourceId(mediaSourceId);
  },

  async searchInDirectory(
    mediaSourceId: string,
    directoryPath: string,
    params: { query?: string; tags?: string[] }
  ): Promise<Media[]> {
    return await searchMediaInDirectory(mediaSourceId, directoryPath, params);
  },
};
