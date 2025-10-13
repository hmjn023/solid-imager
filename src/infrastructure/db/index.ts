import { and, eq, like } from "drizzle-orm";
import { Pool } from "pg";
import type {
  Media,
  MediaSource,
  NewMedia,
  NewMediaSource,
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

import { createDatabaseService, DatabaseService } from "./layer";
import * as schema from "./schema";

export const { db } = createDatabaseService(pool);

export const selectMediaSources = () => db.select().from(mediaSources);

export const selectMediaSourceById = (mediaSourceId: string) =>
  db.select().from(mediaSources).where(eq(mediaSources.id, mediaSourceId));

export const insertMediaSource = (mediaSource: NewMediaSource) =>
  db.insert(mediaSources).values(mediaSource).returning();

export const updateMediaSource = (
  mediaSourceId: string,
  mediaSource: MediaSource
) =>
  db
    .update(mediaSources)
    .set(mediaSource)
    .where(eq(mediaSources.id, mediaSourceId))
    .returning();

export const deleteMediaSource = (mediaSourceId: string) =>
  db.delete(mediaSources).where(eq(mediaSources.id, mediaSourceId)).returning();

export const selectMediasByMediaSourceId = (mediaSourceId: string) =>
  db.select().from(medias).where(eq(medias.sourceId, mediaSourceId));

export const selectMediaById = (mediaId: string) =>
  db.select().from(medias).where(eq(medias.id, mediaId));

export const selectMediaBySourceIdAndFilePath = (
  sourceId: string,
  filePath: string
) =>
  db
    .select()
    .from(medias)
    .where(and(eq(medias.sourceId, sourceId), eq(medias.filePath, filePath)));

export const insertMedia = (media: NewMedia) =>
  db.insert(medias).values(media).returning();

export const updateMedia = (mediaId: string, media: Media) =>
  db.update(medias).set(media).where(eq(medias.id, mediaId)).returning();

export const deleteMedia = (mediaId: string) =>
  db.delete(medias).where(eq(medias.id, mediaId));

export const selectMediaBySourceIdAndDirectoryPath = (
  sourceId: string,
  directoryPath: string
) =>
  db
    .select()
    .from(medias)
    .where(
      and(
        eq(medias.sourceId, sourceId),
        like(medias.filePath, `${directoryPath}%`)
      )
    );

// ========================================
// Feature 2: Thumbnail Functions
// ========================================

// TODO: Implement selectMediaBySourceId
export const selectMediaBySourceId = (_sourceId: string) => {
  throw new Error("Not implemented");
};

// ========================================
// Feature 3: Media Metadata Functions
// ========================================

export const selectMediaGenerationInfoById = (_mediaId: string) => {
  // TODO: Implement metadata retrieval
  throw new Error("Not implemented");
};

export const updateMediaGenerationInfo = (
  _mediaId: string,
  _metadata: unknown
) => {
  // TODO: Implement metadata update
  throw new Error("Not implemented");
};

// ========================================
// Feature 4: SSE Functions
// ========================================

// TODO: Implement if thumbnail job status table exists
export const selectThumbnailJobStatus = (_sourceId: string) => {
  throw new Error("Not implemented");
};

// ========================================
// Feature 7: Search Functions
// ========================================

export const searchMedia = (_sourceId: string, _searchOptions: unknown) => {
  // TODO: Implement media search
  throw new Error("Not implemented");
};

export const searchMediaInDirectory = (
  _sourceId: string,
  _directoriesPath: string,
  _searchOptions: unknown
) => {
  // TODO: Implement directory search
  throw new Error("Not implemented");
};

export const globalSearchMedia = (_searchOptions: unknown) => {
  // TODO: Implement global search across all sources
  throw new Error("Not implemented");
};

// ========================================
// Feature 9: Directory Functions
// ========================================

export const deleteMediaByPath = (
  _sourceId: string,
  _directoryPath: string
) => {
  // TODO: Implement media deletion by path
  throw new Error("Not implemented");
};

// ========================================
// Feature 10: Category Functions
// ========================================

export const selectCategories = () => {
  // TODO: Implement category listing
  throw new Error("Not implemented");
};

export const insertCategory = (_categoryData: unknown) => {
  // TODO: Implement category insertion
  throw new Error("Not implemented");
};

export const selectCategoryById = (_categoryId: number) => {
  // TODO: Implement category retrieval by ID
  throw new Error("Not implemented");
};

export const updateCategory = (_categoryId: number, _categoryData: unknown) => {
  // TODO: Implement category update
  throw new Error("Not implemented");
};

export const deleteCategory = (_categoryId: number) => {
  // TODO: Implement category deletion
  throw new Error("Not implemented");
};

// ========================================
// Feature 11: Character Functions
// ========================================

export const selectCharacters = () => {
  // TODO: Implement character listing
  throw new Error("Not implemented");
};

export const insertCharacter = (_characterData: unknown) => {
  // TODO: Implement character insertion
  throw new Error("Not implemented");
};

export const selectCharacterById = (_characterId: number) => {
  // TODO: Implement character retrieval by ID
  throw new Error("Not implemented");
};

export const updateCharacter = (
  _characterId: number,
  _characterData: unknown
) => {
  // TODO: Implement character update
  throw new Error("Not implemented");
};

export const deleteCharacter = (_characterId: number) => {
  // TODO: Implement character deletion
  throw new Error("Not implemented");
};

// ========================================
// Feature 12: IP Functions
// ========================================

export const selectIps = () => {
  // TODO: Implement IP listing
  throw new Error("Not implemented");
};

export const insertIp = (_ipData: unknown) => {
  // TODO: Implement IP insertion
  throw new Error("Not implemented");
};

export const selectIpById = (_ipId: number) => {
  // TODO: Implement IP retrieval by ID
  throw new Error("Not implemented");
};

export const updateIp = (_ipId: number, _ipData: unknown) => {
  // TODO: Implement IP update
  throw new Error("Not implemented");
};

export const deleteIp = (_ipId: number) => {
  // TODO: Implement IP deletion
  throw new Error("Not implemented");
};

// ========================================
// Feature 13: User Functions
// ========================================

export const selectUsers = () => {
  // TODO: Implement user listing
  throw new Error("Not implemented");
};

export const insertUser = (_userData: unknown) => {
  // TODO: Implement user insertion
  throw new Error("Not implemented");
};

export const selectUserById = (_userId: string) => {
  // TODO: Implement user retrieval by ID
  throw new Error("Not implemented");
};

export const updateUser = (_userId: string, _userData: unknown) => {
  // TODO: Implement user update
  throw new Error("Not implemented");
};

export const deleteUser = (_userId: string) => {
  // TODO: Implement user deletion
  throw new Error("Not implemented");
};

// ========================================
// Feature 14: Collection Functions
// ========================================

export const selectCollections = () => {
  // TODO: Implement collection listing
  throw new Error("Not implemented");
};

export const insertCollection = (_collectionData: unknown) => {
  // TODO: Implement collection insertion
  throw new Error("Not implemented");
};

export const selectCollectionById = (_collectionId: string) => {
  // TODO: Implement collection retrieval by ID
  throw new Error("Not implemented");
};

export const updateCollection = (
  _collectionId: string,
  _collectionData: unknown
) => {
  // TODO: Implement collection update
  throw new Error("Not implemented");
};

export const deleteCollection = (_collectionId: string) => {
  // TODO: Implement collection deletion
  throw new Error("Not implemented");
};

export const insertCollectionMedia = (
  _collectionId: string,
  _mediaId: string,
  _displayOrder?: number
) => {
  // TODO: Implement adding media to collection
  throw new Error("Not implemented");
};

export const deleteCollectionMedia = (
  _collectionId: string,
  _mediaId: string
) => {
  // TODO: Implement removing media from collection
  throw new Error("Not implemented");
};

// ========================================
// Feature 15: Bulk Operation Functions
// ========================================

export const bulkUpdateMedia = (
  _sourceId: string,
  _mediaIds: string[],
  _updates: unknown
) => {
  // TODO: Implement bulk media update
  throw new Error("Not implemented");
};

export const bulkDeleteMedia = (_sourceId: string, _mediaIds: string[]) => {
  // TODO: Implement bulk media deletion
  throw new Error("Not implemented");
};

export const bulkUpdateMediaPaths = (
  _sourceId: string,
  _mediaIds: string[],
  _pathUpdates: unknown
) => {
  // TODO: Implement bulk path updates
  throw new Error("Not implemented");
};

export const bulkAddMediaTags = (
  _sourceId: string,
  _mediaIds: string[],
  _tagsToAdd: number[]
) => {
  // TODO: Implement bulk tag addition
  throw new Error("Not implemented");
};

export const bulkRemoveMediaTags = (
  _sourceId: string,
  _mediaIds: string[],
  _tagsToRemove: number[]
) => {
  // TODO: Implement bulk tag removal
  throw new Error("Not implemented");
};

// ========================================
// Feature 16: Data Migration Functions
// ========================================

export const selectMediaSourceData = (_sourceId: string) => {
  // TODO: Implement source data export
  throw new Error("Not implemented");
};

export const upsertMediaSourceData = (
  _sourceId: string,
  _importData: unknown
) => {
  // TODO: Implement source data import
  throw new Error("Not implemented");
};

export const reconcileMediaSource = (
  _sourceId: string,
  _fileSystemChanges: unknown
) => {
  // TODO: Implement filesystem reconciliation
  throw new Error("Not implemented");
};

export const cloneMediaData = (_sourceId: string, _newSourceId: string) => {
  // TODO: Implement source cloning
  throw new Error("Not implemented");
};

// ========================================
// Feature 18: Analytics Functions
// ========================================

export const selectSourceStats = (_sourceId: string) => {
  // TODO: Implement source statistics
  throw new Error("Not implemented");
};

export const selectGlobalStats = () => {
  // TODO: Implement global statistics
  throw new Error("Not implemented");
};

export const findDuplicateMedia = (_sourceId: string) => {
  // TODO: Implement duplicate detection
  throw new Error("Not implemented");
};

export const findSimilarMedia = (_sourceId: string, _mediaPath: string) => {
  // TODO: Implement similar media detection
  throw new Error("Not implemented");
};

export const selectPopularMedia = () => {
  // TODO: Implement popular media retrieval
  throw new Error("Not implemented");
};

// ========================================
// Feature 19: Workflow Functions
// ========================================

export const insertMediaTags = (_mediaId: string, _tags: unknown) => {
  // TODO: Implement media tag insertion
  throw new Error("Not implemented");
};

// ========================================
// Feature 20: Filter/Preset Functions
// ========================================

export const selectRecentMedia = (_sourceId: string) => {
  // TODO: Implement recent media retrieval
  throw new Error("Not implemented");
};
