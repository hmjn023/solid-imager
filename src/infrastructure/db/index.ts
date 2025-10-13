import { and, eq, like } from "drizzle-orm";
import { Pool } from "pg";
import {
  type Media,
  type MediaSource,
  mediaSources,
  medias,
  type NewMedia,
  type NewMediaSource,
} from "~/infrastructure/db/schema";

const dbHost = process.env.DB_HOST;
if (!dbHost) {
  throw new Error("DB_HOST is not defined in environment variables.");
}

const dbPort = process.env.DB_PORT;
if (!dbPort) {
  throw new Error("DB_PORT is not defined in environment variables.");
}

const dbUser = process.env.DB_USER;
if (!dbUser) {
  throw new Error("DB_USER is not defined in environment variables.");
}

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error("DB_PASSWORD is not defined in environment variables.");
}

const dbDatabase = process.env.DB_DATABASE;
if (!dbDatabase) {
  throw new Error("DB_DATABASE is not defined in environment variables.");
}

export const pool = new Pool({
  host: dbHost,
  port: Number.parseInt(dbPort, 10),
  user: dbUser,
  password: dbPassword,
  database: dbDatabase,
});

import { DatabaseService, createDatabaseServiceLayer } from "./layer";

export const DatabaseLive = createDatabaseServiceLayer(pool);

export const selectMediaSources = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(mediaSources)));
  });

export const selectMediaSourceById = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(mediaSources).where(eq(mediaSources.id, mediaSourceId))));
  });

export const insertMediaSource = (mediaSource: NewMediaSource) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.insert(mediaSources).values(mediaSource).returning()));
  });

export const updateMediaSource = (
  mediaSourceId: string,
  mediaSource: MediaSource
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(mediaSources)
          .set(mediaSource)
          .where(eq(mediaSources.id, mediaSourceId))
          .returning()
      )
    );
  });

export const deleteMediaSource = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.delete(mediaSources).where(eq(mediaSources.id, mediaSourceId)).returning()
      )
    );
  });

export const selectMediasByMediaSourceId = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(medias).where(eq(medias.sourceId, mediaSourceId))));
  });

export const selectMediaById = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(medias).where(eq(medias.id, mediaId))));
  });

export const selectMediaBySourceIdAndFilePath = (
  sourceId: string,
  filePath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(medias)
          .where(and(eq(medias.sourceId, sourceId), eq(medias.filePath, filePath)))
      )
    );
  });

export const insertMedia = (media: NewMedia) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.insert(medias).values(media).returning()));
  });

export const updateMedia = (mediaId: string, media: Media) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.update(medias).set(media).where(eq(medias.id, mediaId)).returning()
      )
    );
  });

export const deleteMedia = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.delete(medias).where(eq(medias.id, mediaId))));
  });

export const selectMediaBySourceIdAndDirectoryPath = (
  sourceId: string,
  directoryPath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(medias)
          .where(
            and(
              eq(medias.sourceId, sourceId),
              like(medias.filePath, `${directoryPath}%`)
            )
          )
      )
    );
  });

// ========================================
// Feature 2: Thumbnail Functions
// ========================================

// TODO: Implement selectMediaBySourceId
export const selectMediaBySourceId = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(medias).where(eq(medias.sourceId, sourceId))));
  });

// ========================================
// Feature 3: Media Metadata Functions
// ========================================

export const selectMediaGenerationInfoById = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(mediaGenerationInfo).where(eq(mediaGenerationInfo.mediaId, mediaId))
      )
    );
  });

export const updateMediaGenerationInfo = (
  mediaId: string,
  metadata: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(mediaGenerationInfo)
          .set({ metadata: metadata as any })
          .where(eq(mediaGenerationInfo.mediaId, mediaId))
          .returning()
      )
    );
  });

// ========================================
// Feature 4: SSE Functions
// ========================================

// TODO: Implement if thumbnail job status table exists
export const selectThumbnailJobStatus = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement if thumbnail job status table exists
    throw new Error("Not implemented");
  });

// ========================================
// Feature 7: Search Functions
// ========================================

export const searchMedia = (sourceId: string, searchOptions: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement media search
    throw new Error("Not implemented");
  });

export const searchMediaInDirectory = (
  sourceId: string,
  directoriesPath: string,
  searchOptions: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement directory search
    throw new Error("Not implemented");
  });

export const globalSearchMedia = (searchOptions: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement global search across all sources
    throw new Error("Not implemented");
  });

// ========================================
// Feature 9: Directory Functions
// ========================================

export const deleteMediaByPath = (
  sourceId: string,
  directoryPath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .delete(medias)
          .where(
            and(
              eq(medias.sourceId, sourceId),
              like(medias.filePath, `${directoryPath}%`)
            )
          )
          .returning()
      )
    );
  });

// ========================================
// Feature 10: Category Functions
// ========================================

export const selectCategories = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(categories)));
  });

export const insertCategory = (categoryData: NewCategory) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.insert(categories).values(categoryData).returning()));
  });

export const selectCategoryById = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(categories).where(eq(categories.id, categoryId))
      )
    );
  });

export const updateCategory = (categoryId: number, categoryData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement category update
    throw new Error("Not implemented");
  });

export const deleteCategory = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement category deletion
    throw new Error("Not implemented");
  });

// ========================================
// Feature 11: Character Functions
// ========================================

export const selectCharacters = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement character listing
    throw new Error("Not implemented");
  });

export const insertCharacter = (characterData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement character insertion
    throw new Error("Not implemented");
  });

export const selectCharacterById = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement character retrieval by ID
    throw new Error("Not implemented");
  });

export const updateCharacter = (
  characterId: number,
  characterData: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement character update
    throw new Error("Not implemented");
  });

export const deleteCharacter = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement character deletion
    throw new Error("Not implemented");
  });

// ========================================
// Feature 12: IP Functions
// ========================================

export const selectIps = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement IP listing
    throw new Error("Not implemented");
  });

export const insertIp = (ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement IP insertion
    throw new Error("Not implemented");
  });

export const selectIpById = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement IP retrieval by ID
    throw new Error("Not implemented");
  });

export const updateIp = (ipId: number, ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement IP update
    throw new Error("Not implemented");
  });

export const deleteIp = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement IP deletion
    throw new Error("Not implemented");
  });

// ========================================
// Feature 13: User Functions
// ========================================

export const selectUsers = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement user listing
    throw new Error("Not implemented");
  });

export const insertUser = (userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement user insertion
    throw new Error("Not implemented");
  });

export const selectUserById = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement user retrieval by ID
    throw new Error("Not implemented");
  });

export const updateUser = (userId: string, userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement user update
    throw new Error("Not implemented");
  });

export const deleteUser = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement user deletion
    throw new Error("Not implemented");
  });

// ========================================
// Feature 14: Collection Functions
// ========================================

export const selectCollections = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement collection listing
    throw new Error("Not implemented");  });

export const insertCollection = (collectionData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement collection insertion
    throw new Error("Not implemented");
  });

export const selectCollectionById = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement collection retrieval by ID
    throw new Error("Not implemented");
  });

export const updateCollection = (
  collectionId: string,
  collectionData: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement collection update
    throw new Error("Not implemented");
  });

export const deleteCollection = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement collection deletion
    throw new Error("Not implemented");
  });

export const insertCollectionMedia = (
  collectionId: string,
  mediaId: string,
  displayOrder?: number
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement adding media to collection
    throw new Error("Not implemented");
  });

export const deleteCollectionMedia = (
  collectionId: string,
  mediaId: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement removing media from collection
    throw new Error("Not implemented");
  });

// ========================================
// Feature 15: Bulk Operation Functions
// ========================================

export const bulkUpdateMedia = (
  sourceId: string,
  mediaIds: string[],
  updates: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement bulk media update
    throw new Error("Not implemented");
  });

export const bulkDeleteMedia = (sourceId: string, mediaIds: string[]) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement bulk media deletion
    throw new Error("Not implemented");
  });

export const bulkUpdateMediaPaths = (
  sourceId: string,
  mediaIds: string[],
  pathUpdates: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement bulk path updates
    throw new Error("Not implemented");
  });

export const bulkAddMediaTags = (
  sourceId: string,
  mediaIds: string[],
  tagsToAdd: number[]
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement bulk tag addition
    throw new Error("Not implemented");
  });

export const bulkRemoveMediaTags = (
  sourceId: string,
  mediaIds: string[],
  tagsToRemove: number[]
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement bulk tag removal
    throw new Error("Not implemented");
  });

// ========================================
// Feature 16: Data Migration Functions
// ========================================

export const selectMediaSourceData = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement source data export
    throw new Error("Not implemented");
  });

export const upsertMediaSourceData = (
  sourceId: string,
  importData: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement source data import
    throw new Error("Not implemented");
  });

export const reconcileMediaSource = (
  sourceId: string,
  fileSystemChanges: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement filesystem reconciliation
    throw new Error("Not implemented");
  });

export const cloneMediaData = (sourceId: string, newSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement source cloning
    throw new Error("Not implemented");
  });

// ========================================
// Feature 18: Analytics Functions
// ========================================

export const selectSourceStats = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement source statistics
    throw new Error("Not implemented");
  });

export const selectGlobalStats = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement global statistics
    throw new Error("Not implemented");
  });

export const findDuplicateMedia = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement duplicate detection
    throw new Error("Not implemented");
  });

export const findSimilarMedia = (sourceId: string, mediaPath: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement similar media detection
    throw new Error("Not implemented");
  });

export const selectPopularMedia = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement popular media retrieval
    throw new Error("Not implemented");
  });

// ========================================
// Feature 19: Workflow Functions
// ========================================

export const insertMediaTags = (mediaId: string, tags: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement media tag insertion
    throw new Error("Not implemented");
  });

// ========================================
// Feature 20: Filter/Preset Functions
// ========================================

export const selectRecentMedia = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    // TODO: Implement recent media retrieval
    throw new Error("Not implemented");
  });
