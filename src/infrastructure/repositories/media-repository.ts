import { and, eq } from "drizzle-orm";
import type { Transaction } from "~/domain/interfaces/transaction-manager";
import {
  type AddMediaRequest,
  type Author,
  type Media,
  type MediaGenerationInfo,
  type MediaSearchRequest,
  type MediaSearchResponse,
  type MediaTag,
  type MediaUrl,
  mediaSearchResponseSchema,
  type UpdateMediaRequest,
} from "~/domain/media/schemas";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import { db } from "~/infrastructure/db/index";
import {
  mediaGenerationInfo,
  medias,
  mediaUrls,
  type NewMedia,
} from "~/infrastructure/db/schema";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { NotFoundError, UnknownDbError } from "../db/errors";
// import { selectMediaGenerationInfoById } from "~/infrastructure/db/queries/media-generation-info"; // Removed
// import { selectMediaUrlsByMediaId } from "~/infrastructure/db/queries/media-urls"; // Removed
import {
  searchMediaInDirectory,
  searchMedia as searchMediaQuery,
} from "./media-repository-utils";

export const MediaRepository: IMediaRepository = {
  /**
   * Retrieves a specific media item by its ID.
   */
  async findById(mediaId: string, tx?: Transaction): Promise<Media | null> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
        .select()
        .from(medias)
        .where(eq(medias.id, mediaId));
      if (result.length === 0) {
        return null;
      }
      return result[0];
    } catch (e) {
      if (e instanceof NotFoundError) {
        return null;
      }
      throw new UnknownDbError({
        message: `Failed to select media by ID: ${mediaId}`,
        details: e,
      });
    }
  },

  /**
   * Retrieves a specific media item by Source ID and File Path.
   */
  async findByPath(
    sourceId: string,
    filePath: string,
    tx?: Transaction
  ): Promise<Media | null> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
        .select({
          id: medias.id,
          mediaSourceId: medias.mediaSourceId,
          filePath: medias.filePath,
          fileName: medias.fileName,
          mediaType: medias.mediaType,
          width: medias.width,
          height: medias.height,
          fileSize: medias.fileSize,
          description: medias.description,
          createdAt: medias.createdAt,
          modifiedAt: medias.modifiedAt,
          indexedAt: medias.indexedAt,
          status: medias.status,
        })
        .from(medias)
        .where(
          and(eq(medias.mediaSourceId, sourceId), eq(medias.filePath, filePath))
        );
      return result[0] || null;
    } catch (error) {
      throw new UnknownDbError({
        message: "Failed to select media by source ID and file path",
        details: error,
      });
    }
  },

  /**
   * Creates a new media entry in the database.
   */
  async create(media: AddMediaRequest, tx?: Transaction): Promise<Media> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const newMedia: NewMedia = {
        ...media,
        status: "active",
        indexedAt: new Date(),
      };
      const result = await client.insert(medias).values(newMedia).returning();
      return result[0];
    } catch (error) {
      throw new UnknownDbError({
        message: "Failed to insert media",
        details: error,
      });
    }
  },

  /**
   * Updates an existing media entry.
   */
  async update(
    mediaId: string,
    updates: UpdateMediaRequest,
    tx?: Transaction
  ): Promise<Media> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const dbUpdates: Partial<NewMedia> = {};

      if (updates.filePath !== undefined) {
        dbUpdates.filePath = updates.filePath;
      }
      if (updates.fileName !== undefined) {
        dbUpdates.fileName = updates.fileName;
      }
      if (updates.fileSize !== undefined) {
        dbUpdates.fileSize = updates.fileSize;
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

      dbUpdates.modifiedAt = updates.modifiedAt || new Date();

      const result = await client
        .update(medias)
        .set(dbUpdates)
        .where(eq(medias.id, mediaId))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError({
          message: `Media with ID ${mediaId} not found`,
        });
      }
      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new UnknownDbError({
        message: `Failed to update media with ID: ${mediaId}`,
        details: error,
      });
    }
  },

  /**
   * Deletes a media entry from the database.
   */
  async delete(mediaId: string, tx?: Transaction): Promise<void> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
        .delete(medias)
        .where(eq(medias.id, mediaId))
        .returning();
      if (result.length === 0) {
        throw new NotFoundError({
          message: `Media with ID ${mediaId} not found`,
        });
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new UnknownDbError({
        message: `Failed to delete media with ID: ${mediaId}`,
        details: error,
      });
    }
  },

  /**
   * Searches for media based on criteria.
   */
  async search(
    mediaSourceId: string,
    params: MediaSearchRequest,
    tx?: Transaction
  ): Promise<MediaSearchResponse> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
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

    // Note: searchMediaQuery currently doesn't accept tx.
    // However, it builds a query object. In Drizzle we might need to pass the client.
    // Let's assume for now search is read-only and doesn't strictly need to be in the same connection
    // UNLESS we are in PGlite where we MUST be on the same connection if a transaction is open.
    // I will update searchMediaQuery to accept client later if needed.
    const result = await searchMediaQuery(
      mediaSourceId,
      {
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
      },
      client
    );

    return mediaSearchResponseSchema.parse(result);
  },

  async getTags(mediaId: string, tx?: Transaction): Promise<MediaTag[]> {
    return await TagRepository.findByMediaId(mediaId, tx);
  },

  async getGenerationInfo(
    mediaId: string,
    tx?: Transaction
  ): Promise<MediaGenerationInfo | null> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
        .select()
        .from(mediaGenerationInfo)
        .where(eq(mediaGenerationInfo.mediaId, mediaId));
      if (result.length === 0) {
        return null;
      }
      const info = result[0];
      return {
        ...info,
        aiGenerated: info.aiGenerated ?? false,
        modelName: info.modelName ?? "",
        seed: info.seed ?? -1,
        cfgScale: info.cfgScale ?? 0,
        steps: info.steps ?? 0,
      };
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to select media generation info for mediaId: ${mediaId}`,
        details: error,
      });
    }
  },

  async getAuthors(mediaId: string, tx?: Transaction): Promise<Author[]> {
    return await AuthorRepository.findByMediaId(mediaId, tx);
  },

  async getUrls(mediaId: string, tx?: Transaction): Promise<MediaUrl[]> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      return await client
        .select()
        .from(mediaUrls)
        .where(eq(mediaUrls.mediaId, mediaId));
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to select media URLs for mediaId: ${mediaId}`,
        details: error,
      });
    }
  },

  async addUrls(
    mediaId: string,
    urls: string[],
    tx?: Transaction
  ): Promise<MediaUrl[]> {
    if (urls.length === 0) {
      return [];
    }
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const values = urls.map((url) => ({
        mediaId,
        url,
      }));
      return await client.insert(mediaUrls).values(values).returning();
    } catch (error) {
      throw new UnknownDbError({
        message: "Failed to insert media URLs",
        details: error,
      });
    }
  },

  async upsertGenerationInfo(
    mediaId: string,
    prompt: string | null,
    workflow: unknown,
    tx?: Transaction
  ): Promise<MediaGenerationInfo> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const values = {
        mediaId,
        prompt,
        workflow,
        metadata: { prompt }, // legacy compatibility or derived
      };
      // Simple upsert
      const result = await client
        .insert(mediaGenerationInfo)
        .values(values)
        .onConflictDoUpdate({
          target: mediaGenerationInfo.mediaId,
          set: values,
        })
        .returning();
      const info = result[0];
      return {
        ...info,
        aiGenerated: info.aiGenerated ?? false,
        modelName: info.modelName ?? "",
        seed: info.seed ?? -1,
        cfgScale: info.cfgScale ?? 0,
        steps: info.steps ?? 0,
      };
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to upsert media generation info for mediaId: ${mediaId}`,
        details: error,
      });
    }
  },

  // Bulk
  async findAllBySourceId(
    mediaSourceId: string,
    tx?: Transaction
  ): Promise<Media[]> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      return await client
        .select()
        .from(medias)
        .where(eq(medias.mediaSourceId, mediaSourceId));
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to select medias by source ID: ${mediaSourceId}`,
        details: error,
      });
    }
  },

  async searchInDirectory(
    mediaSourceId: string,
    directoryPath: string,
    params: { query?: string; tags?: string[] },
    tx?: Transaction
  ): Promise<Media[]> {
    const client =
      /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
      db;
    return await searchMediaInDirectory(
      mediaSourceId,
      directoryPath,
      params,
      client
    );
  },
};
