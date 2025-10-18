import { Pool } from "pg";

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

import { createDatabaseServiceLayer } from "./layer";

export const DatabaseLive = createDatabaseServiceLayer(pool);

export {
  bulkAddMediaTags,
  bulkDeleteMedia,
  bulkRemoveMediaTags,
  bulkUpdateMedia,
  bulkUpdateMediaPaths,
} from "./bulk-operations";
export {
  deleteCategory,
  insertCategory,
  selectCategories,
  selectCategoryById,
  updateCategory,
} from "./categories";
export {
  deleteCharacter,
  insertCharacter,
  selectCharacterById,
  selectCharacters,
  updateCharacter,
} from "./characters";
export {
  deleteCollection,
  deleteCollectionMedia,
  insertCollection,
  insertCollectionMedia,
  selectCollectionById,
  selectCollections,
  updateCollection,
} from "./collections";
export {
  cloneMediaData,
  reconcileMediaSource,
  selectMediaSourceData,
  upsertMediaSourceData,
} from "./data-migration";
export {
  deleteIp,
  insertIp,
  selectIpById,
  selectIps,
  updateIp,
} from "./ips";
export { selectJobsBySourceId } from "./jobs";
export {
  deleteMedia,
  deleteMediaByPath,
  insertMedia,
  selectMediaById,
  selectMediaBySourceId,
  selectMediaBySourceIdAndDirectoryPath,
  selectMediaBySourceIdAndFilePath,
  updateMedia,
} from "./media";
export {
  selectMediaGenerationInfoById,
  updateMediaGenerationInfo,
} from "./media-generation-info";
export {
  deleteMediaSource,
  insertMediaSource,
  selectMediaSourceById,
  selectMediaSources,
  updateMediaSource,
} from "./media-sources";
export { insertMediaTags } from "./media-tags";
export {
  globalSearchMedia,
  searchMedia,
  searchMediaInDirectory,
} from "./search";
export {
  deleteUser,
  insertUser,
  selectUserById,
  selectUsers,
  updateUser,
} from "./users";

// ========================================
// Feature 2: Thumbnail Functions
// ========================================

// ========================================
// Feature 3: Media Metadata Functions
// ========================================

// ========================================
// Feature 4: SSE Functions
// ========================================

// TODO: Implement if thumbnail job status table exists

// ========================================
// Feature 7: Search Functions
// ========================================

// ========================================
// Feature 9: Directory Functions
// ========================================

// ========================================
// Feature 10: Category Functions
// ========================================

// ========================================
// Feature 11: Character Functions
// ========================================

// ========================================
// Feature 12: IP Functions
// ========================================

// ========================================
// Feature 13: User Functions
// ========================================

// ========================================
// Feature 14: Collection Functions
// ========================================

// ========================================
// Feature 15: Bulk Operation Functions
// ========================================

// ========================================

// Feature 19: Workflow Functions

// ========================================

// ========================================
// Feature 16: Data Migration Functions
// ========================================

// ========================================
// Feature 18: Analytics Functions
// ========================================
