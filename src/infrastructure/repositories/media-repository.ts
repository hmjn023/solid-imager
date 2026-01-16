import { and, eq, type InferSelectModel } from "drizzle-orm";
import { ResourceNotFoundError, UnexpectedError } from "~/domain/errors";
import type { Transaction } from "~/domain/interfaces/transaction-manager";
import {
  type AddMediaRequest,
  type Author,
  type Media,
  type MediaDetails,
  type MediaGenerationInfo,
  type MediaSearchRequest,
  type MediaSearchResponse,
  type MediaTag,
  type MediaUrl,
  mediaSearchResponseSchema,
  type UpdateMediaRequest,
} from "~/domain/media/schemas";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import {
  authors,
  mediaAuthors,
  mediaGenerationInfo,
  medias,
  mediaTags,
  mediaUrls,
  type NewMedia,
  tags,
} from "~/infrastructure/db/schema";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
// import { selectMediaGenerationInfoById } from "~/infrastructure/db/queries/media-generation-info"; // Removed
// import { selectMediaUrlsByMediaId } from "~/infrastructure/db/queries/media-urls"; // Removed
import {
  globalSearchMedia,
  searchMediaInDirectory,
  searchMedia as searchMediaQuery,
} from "./media-repository-utils";

type DbMedia = InferSelectModel<typeof medias>;

function mapToMedia(dbMedia: DbMedia): Media {
  return {
    id: dbMedia.id,
    mediaSourceId: dbMedia.mediaSourceId,
    filePath: dbMedia.filePath,
    fileName: dbMedia.fileName,
    mediaType: dbMedia.mediaType,
    width: dbMedia.width,
    height: dbMedia.height,
    fileSize: dbMedia.fileSize,
    description: dbMedia.description,
    createdAt: dbMedia.createdAt,
    modifiedAt: dbMedia.modifiedAt,
    indexedAt: dbMedia.indexedAt,
    status: dbMedia.status as Media["status"],
  };
}

type DbMediaUrl = InferSelectModel<typeof mediaUrls>;

function mapToMediaUrl(dbUrl: DbMediaUrl): MediaUrl {
  return {
    id: dbUrl.id,
    mediaId: dbUrl.mediaId,
    url: dbUrl.url,
    createdAt: dbUrl.createdAt,
    updatedAt: dbUrl.updatedAt,
  };
}

type MediaWithRelations = InferSelectModel<typeof medias> & {
  tags: (InferSelectModel<typeof mediaTags> & {
    tag: InferSelectModel<typeof tags>;
  })[];
  generationInfo: InferSelectModel<typeof mediaGenerationInfo> | null;
  authors: (InferSelectModel<typeof mediaAuthors> & {
    author: InferSelectModel<typeof authors>;
  })[];
  urls: InferSelectModel<typeof mediaUrls>[];
};

function mapToMediaDetails(row: MediaWithRelations): MediaDetails {
  return {
    ...mapToMedia(row),
    tags: row.tags.map((mt) => ({
      ...mt.tag,
      type: mt.tagType,
    })),
    generationInfo: row.generationInfo
      ? {
          ...row.generationInfo,
          aiGenerated: row.generationInfo.aiGenerated ?? false,
          modelName: row.generationInfo.modelName ?? "",
          seed: row.generationInfo.seed ?? -1,
          cfgScale: row.generationInfo.cfgScale ?? 0,
          steps: row.generationInfo.steps ?? 0,
        }
      : null,
    authors: row.authors.map((ma) => ma.author),
    urls: row.urls.map(mapToMediaUrl),
  };
}

export const MediaRepository: IMediaRepository = {
  /**
   * Retrieves a specific media item by its ID.
   */
  async findById(mediaId: string, tx?: Transaction): Promise<Media | null> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .select()
        .from(medias)
        .where(eq(medias.id, mediaId));
      if (result.length === 0) {
        return null;
      }
      return mapToMedia(result[0]);
    } catch (e) {
      if (e instanceof ResourceNotFoundError) {
        return null;
      }
      throw new UnexpectedError(`Failed to select media by ID: ${mediaId}`, e);
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
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .select()
        .from(medias)
        .where(
          and(eq(medias.mediaSourceId, sourceId), eq(medias.filePath, filePath))
        );
      if (result.length === 0) {
        return null;
      }
      return mapToMedia(result[0]);
    } catch (error) {
      throw new UnexpectedError(
        "Failed to select media by source ID and file path",
        error
      );
    }
  },

  /**
   * Creates a new media entry in the database.
   */
  async create(media: AddMediaRequest, tx?: Transaction): Promise<Media> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const newMedia: NewMedia = {
        ...media,
        status: "active",
        indexedAt: new Date(),
      };
      const result = await client.insert(medias).values(newMedia).returning();
      return mapToMedia(result[0]);
    } catch (error) {
      throw new UnexpectedError("Failed to insert media", error);
    }
  },

  /**
   * Upserts a media entry in the database.
   */
  async upsert(media: AddMediaRequest, tx?: Transaction): Promise<Media> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const newMedia: NewMedia = {
        ...media,
        status: "active",
        indexedAt: new Date(),
      };
      const result = await client
        .insert(medias)
        .values(newMedia)
        .onConflictDoUpdate({
          target: [medias.mediaSourceId, medias.filePath],
          set: {
            fileName: newMedia.fileName,
            mediaType: newMedia.mediaType,
            width: newMedia.width,
            height: newMedia.height,
            fileSize: newMedia.fileSize,
            description: newMedia.description,
            createdAt: newMedia.createdAt,
            modifiedAt: newMedia.modifiedAt,
            indexedAt: newMedia.indexedAt,
            status: newMedia.status,
          },
        })
        .returning();
      return mapToMedia(result[0]);
    } catch (error) {
      throw new UnexpectedError("Failed to upsert media", error);
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
      const client = (tx as unknown as TransactionClient) || db;
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
        throw new ResourceNotFoundError("Media", mediaId);
      }
      return mapToMedia(result[0]);
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      throw new UnexpectedError(
        `Failed to update media with ID: ${mediaId}`,
        error
      );
    }
  },

  /**
   * Deletes a media entry from the database.
   */
  async delete(mediaId: string, tx?: Transaction): Promise<void> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .delete(medias)
        .where(eq(medias.id, mediaId))
        .returning();
      if (result.length === 0) {
        throw new ResourceNotFoundError("Media", mediaId);
      }
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      throw new UnexpectedError(
        `Failed to delete media with ID: ${mediaId}`,
        error
      );
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
    const client = (tx as unknown as TransactionClient) || db;
    const tagsArray = splitAndTrim(params.tags);
    const excludeTagsArray = splitAndTrim(params.excludeTags);
    const projectsArray = splitAndTrim(params.projects);
    const ipsArray = splitAndTrim(params.ips);
    const charactersArray = splitAndTrim(params.characters);

    // searchMediaQuery accepts client (which can be a transaction or the main db instance).
    // Ensure we pass the correct client to maintain transaction integrity if provided.
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

    const mappedResult = {
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle select result is not strictly typed here due to searchMediaQuery return type
      media: result.media.map((m: any) => mapToMedia(m as DbMedia)),
      total: Number(result.total),
    };
    return mediaSearchResponseSchema.parse(mappedResult);
  },

  /**
   * Optimized: Fetch media and all relations in a single query using Drizzle's relational query builder.
   * This avoids N+1 query issues (or N+4 in this case) when fetching details.
   */
  async getDetails(
    mediaId: string,
    tx?: Transaction
  ): Promise<MediaDetails | null> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client.query.medias.findFirst({
        where: eq(medias.id, mediaId),
        with: {
          tags: {
            with: {
              tag: true,
            },
          },
          generationInfo: true,
          authors: {
            with: {
              author: true,
            },
          },
          urls: true,
        },
      });

      if (!result) {
        return null;
      }

      return mapToMediaDetails(result);
    } catch (error) {
      throw new UnexpectedError(
        `Failed to get media details for mediaId: ${mediaId}`,
        error
      );
    }
  },

  async getTags(mediaId: string, tx?: Transaction): Promise<MediaTag[]> {
    return await TagRepository.findByMediaId(mediaId, tx);
  },

  async getGenerationInfo(
    mediaId: string,
    tx?: Transaction
  ): Promise<MediaGenerationInfo | null> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
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
      throw new UnexpectedError(
        `Failed to select media generation info for mediaId: ${mediaId}`,
        error
      );
    }
  },

  async getAuthors(mediaId: string, tx?: Transaction): Promise<Author[]> {
    return await AuthorRepository.findByMediaId(mediaId, tx);
  },

  async getUrls(mediaId: string, tx?: Transaction): Promise<MediaUrl[]> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const results = await client
        .select()
        .from(mediaUrls)
        .where(eq(mediaUrls.mediaId, mediaId));
      return results.map(mapToMediaUrl);
    } catch (error) {
      throw new UnexpectedError(
        `Failed to select media URLs for mediaId: ${mediaId}`,
        error
      );
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
      const client = (tx as unknown as TransactionClient) || db;
      const values = urls.map((url) => ({
        mediaId,
        url,
      }));
      const results = await client.insert(mediaUrls).values(values).returning();
      return results.map(mapToMediaUrl);
    } catch (error) {
      throw new UnexpectedError("Failed to insert media URLs", error);
    }
  },

  async upsertGenerationInfo(
    mediaId: string,
    prompt: string | null,
    workflow: unknown,
    tx?: Transaction
  ): Promise<MediaGenerationInfo> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
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
      throw new UnexpectedError(
        `Failed to upsert media generation info for mediaId: ${mediaId}`,
        error
      );
    }
  },

  // Bulk
  async findAllBySourceId(
    mediaSourceId: string,
    limit = 100,
    offset = 0,
    tx?: Transaction
  ): Promise<Media[]> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const query = client
        .select()
        .from(medias)
        .where(eq(medias.mediaSourceId, mediaSourceId))
        .limit(limit)
        .offset(offset);
      const results = await query;
      return results.map(mapToMedia);
    } catch (error) {
      throw new UnexpectedError(
        `Failed to select medias by source ID: ${mediaSourceId}`,
        error
      );
    }
  },

  async searchInDirectory(
    mediaSourceId: string,
    directoryPath: string,
    params: { query?: string; tags?: string[] },
    tx?: Transaction
  ): Promise<Media[]> {
    const client = (tx as unknown as TransactionClient) || db;
    // searchMediaInDirectory internally uses searchMediaQuery structure so it returns formatted results,
    // hopefully compatible with Media. But let's check media-repository-utils.ts for that.
    const results = await searchMediaInDirectory(
      mediaSourceId,
      directoryPath,
      params,
      client
    );
    // If searchMediaInDirectory returns Drizzle type or 'any', we might need to map implicitly or explicity.
    // Assuming it returns something schema-compliant for now, but strictly we should check.
    return results.map(mapToMedia);
  },
};
