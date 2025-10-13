# DB Operations Contracts

このドキュメントでは、Effect-TSを適用したDB操作系関数のインターフェースを定義します。
各関数は`Effect<never, DBError, Result>`の形式で結果を返します。

## エラー型

`src/infrastructure/db/errors.ts`で定義される`DBError`を想定します。これは`AppError`を拡張またはラップしたものです。

```typescript
import { Effect } from "@effect/io/Effect";
import { AppError } from "~/docs/design/07-type-definitions"; // AppErrorをインポート

// DB操作固有のエラー型
export type DBError = AppError; // 仮にAppErrorをそのまま使用
```

## 型定義

`src/infrastructure/db/schema.ts`から主要な型をインポートします。

```typescript
import type {
  MediaSource, NewMediaSource, Media, NewMedia, Tag, NewTag,
  Category, NewCategory, Character, NewCharacter, Ip, NewIp,
  User, NewUser, Collection, NewCollection,
  MediaDetails, MediaGenerationInfo, MediaOrganization, MediaTechnicalInfo, MediaSync,
  ViewHistory, SimilarMedia, CollectionMedia, MediaCharacter, MediaTag
} from "~/infrastructure/db/schema";
```

## DB操作インターフェース

### MediaSourceDBOperations

```typescript
export interface MediaSourceDBOperations {
  selectMediaSources: () => Effect<never, DBError, MediaSource[]>;
  selectMediaSourceById: (mediaSourceId: string) => Effect<never, DBError, MediaSource | undefined>;
  insertMediaSource: (mediaSource: NewMediaSource) => Effect<never, DBError, MediaSource[]>;
  updateMediaSource: (mediaSourceId: string, mediaSource: MediaSource) => Effect<never, DBError, MediaSource[]>;
  deleteMediaSource: (mediaSourceId: string) => Effect<never, DBError, MediaSource[]>;
}
```

### MediaDBOperations

```typescript
export interface MediaDBOperations {
  selectMediasByMediaSourceId: (mediaSourceId: string) => Effect<never, DBError, Media[]>;
  selectMediaById: (mediaId: string) => Effect<never, DBError, Media | undefined>;
  selectMediaBySourceIdAndFilePath: (sourceId: string, filePath: string) => Effect<never, DBError, Media[]>;
  insertMedia: (media: NewMedia) => Effect<never, DBError, Media[]>;
  updateMedia: (mediaId: string, media: Media) => Effect<never, DBError, Media[]>;
  deleteMedia: (mediaId: string) => Effect<never, DBError, void>;
  selectMediaBySourceIdAndDirectoryPath: (sourceId: string, directoryPath: string) => Effect<never, DBError, Media[]>;
  selectMediaBySourceId: (sourceId: string) => Effect<never, DBError, Media[]>; // TODO: Implement
}
```

### MediaGenerationInfoDBOperations

```typescript
export interface MediaGenerationInfoDBOperations {
  selectMediaGenerationInfoById: (mediaId: string) => Effect<never, DBError, MediaGenerationInfo | undefined>; // TODO: Implement
  updateMediaGenerationInfo: (mediaId: string, metadata: unknown) => Effect<never, DBError, MediaGenerationInfo[]>; // TODO: Implement
}
```

### ThumbnailJobStatusDBOperations

```typescript
export interface ThumbnailJobStatusDBOperations {
  selectThumbnailJobStatus: (sourceId: string) => Effect<never, DBError, unknown>; // TODO: Implement (if thumbnail job status table exists)
}
```

### SearchDBOperations

```typescript
export interface SearchDBOperations {
  searchMedia: (sourceId: string, searchOptions: unknown) => Effect<never, DBError, Media[]>; // TODO: Implement
  searchMediaInDirectory: (sourceId: string, directoriesPath: string, searchOptions: unknown) => Effect<never, DBError, Media[]>; // TODO: Implement
  globalSearchMedia: (searchOptions: unknown) => Effect<never, DBError, Media[]>; // TODO: Implement
}
```

### DirectoryDBOperations

```typescript
export interface DirectoryDBOperations {
  deleteMediaByPath: (sourceId: string, directoryPath: string) => Effect<never, DBError, void>; // TODO: Implement
}
```

### CategoryDBOperations

```typescript
export interface CategoryDBOperations {
  selectCategories: () => Effect<never, DBError, Category[]>; // TODO: Implement
  insertCategory: (categoryData: NewCategory) => Effect<never, DBError, Category[]>; // TODO: Implement
  selectCategoryById: (categoryId: number) => Effect<never, DBError, Category | undefined>; // TODO: Implement
  updateCategory: (categoryId: number, categoryData: Category) => Effect<never, DBError, Category[]>; // TODO: Implement
  deleteCategory: (categoryId: number) => Effect<never, DBError, Category[]>; // TODO: Implement
}
```

### CharacterDBOperations

```typescript
export interface CharacterDBOperations {
  selectCharacters: () => Effect<never, DBError, Character[]>; // TODO: Implement
  insertCharacter: (characterData: NewCharacter) => Effect<never, DBError, Character[]>; // TODO: Implement
  selectCharacterById: (characterId: number) => Effect<never, DBError, Character | undefined>; // TODO: Implement
  updateCharacter: (characterId: number, characterData: Character) => Effect<never, DBError, Character[]>; // TODO: Implement
  deleteCharacter: (characterId: number) => Effect<never, DBError, Character[]>; // TODO: Implement
}
```

### IpDBOperations

```typescript
export interface IpDBOperations {
  selectIps: () => Effect<never, DBError, Ip[]>; // TODO: Implement
  insertIp: (ipData: NewIp) => Effect<never, DBError, Ip[]>; // TODO: Implement
  selectIpById: (ipId: number) => Effect<never, DBError, Ip | undefined>; // TODO: Implement
  updateIp: (ipId: number, ipData: Ip) => Effect<never, DBError, Ip[]>; // TODO: Implement
  deleteIp: (ipId: number) => Effect<never, DBError, Ip[]>; // TODO: Implement
}
```

### UserDBOperations

```typescript
export interface UserDBOperations {
  selectUsers: () => Effect<never, DBError, User[]>; // TODO: Implement
  insertUser: (userData: NewUser) => Effect<never, DBError, User[]>; // TODO: Implement
  selectUserById: (userId: string) => Effect<never, DBError, User | undefined>; // TODO: Implement
  updateUser: (userId: string, userData: User) => Effect<never, DBError, User[]>; // TODO: Implement
  deleteUser: (userId: string) => Effect<never, DBError, User[]>; // TODO: Implement
}
```

### CollectionDBOperations

```typescript
export interface CollectionDBOperations {
  selectCollections: () => Effect<never, DBError, Collection[]>; // TODO: Implement
  insertCollection: (collectionData: NewCollection) => Effect<never, DBError, Collection[]>; // TODO: Implement
  selectCollectionById: (collectionId: string) => Effect<never, DBError, Collection | undefined>; // TODO: Implement
  updateCollection: (collectionId: string, collectionData: Collection) => Effect<never, DBError, Collection[]>; // TODO: Implement
  deleteCollection: (collectionId: string) => Effect<never, DBError, Collection[]>; // TODO: Implement
  insertCollectionMedia: (collectionId: string, mediaId: string, displayOrder?: number) => Effect<never, DBError, CollectionMedia[]>; // TODO: Implement
  deleteCollectionMedia: (collectionId: string, mediaId: string) => Effect<never, DBError, void>; // TODO: Implement
}
```

### BulkOperationDBOperations

```typescript
export interface BulkOperationDBOperations {
  bulkUpdateMedia: (sourceId: string, mediaIds: string[], updates: unknown) => Effect<never, DBError, void>; // TODO: Implement
  bulkDeleteMedia: (sourceId: string, mediaIds: string[]) => Effect<never, DBError, void>; // TODO: Implement
  bulkUpdateMediaPaths: (sourceId: string, mediaIds: string[], pathUpdates: unknown) => Effect<never, DBError, void>; // TODO: Implement
  bulkAddMediaTags: (sourceId: string, mediaIds: string[], tagsToAdd: number[]) => Effect<never, DBError, void>; // TODO: Implement
  bulkRemoveMediaTags: (sourceId: string, mediaIds: string[], tagsToRemove: number[]) => Effect<never, DBError, void>; // TODO: Implement
}
```

### DataMigrationDBOperations

```typescript
export interface DataMigrationDBOperations {
  selectMediaSourceData: (sourceId: string) => Effect<never, DBError, unknown>; // TODO: Implement
  upsertMediaSourceData: (sourceId: string, importData: unknown) => Effect<never, DBError, void>; // TODO: Implement
  reconcileMediaSource: (sourceId: string, fileSystemChanges: unknown) => Effect<never, DBError, void>; // TODO: Implement
  cloneMediaData: (sourceId: string, newSourceId: string) => Effect<never, DBError, void>; // TODO: Implement
}
```

### AnalyticsDBOperations

```typescript
export interface AnalyticsDBOperations {
  selectSourceStats: (sourceId: string) => Effect<never, DBError, unknown>; // TODO: Implement
  selectGlobalStats: () => Effect<never, DBError, unknown>; // TODO: Implement
  findDuplicateMedia: (sourceId: string) => Effect<never, DBError, Media[]>; // TODO: Implement
  findSimilarMedia: (sourceId: string, mediaPath: string) => Effect<never, DBError, Media[]>; // TODO: Implement
  selectPopularMedia: () => Effect<never, DBError, Media[]>; // TODO: Implement
}
```

### WorkflowDBOperations

```typescript
export interface WorkflowDBOperations {
  selectJobs: () => Effect<never, DBError, unknown[]>; // TODO: Implement
  updateJobStatus: (jobId: number, status: unknown) => Effect<never, DBError, void>; // TODO: Implement
  selectMediaForAutoTagging: (sourceId: string) => Effect<never, DBError, Media[]>; // TODO: Implement
  insertMediaTags: (mediaId: string, tags: unknown) => Effect<never, DBError, void>; // TODO: Implement
}
```

### FilterPresetDBOperations

```typescript
export interface FilterPresetDBOperations {
  selectPresets: () => Effect<never, DBError, unknown[]>; // TODO: Implement
  insertPreset: (presetData: unknown) => Effect<never, DBError, unknown[]>; // TODO: Implement
  selectRandomMedia: (sourceId: string) => Effect<never, DBError, Media[]>; // TODO: Implement
  selectRecentMedia: (sourceId: string) => Effect<never, DBError, Media[]>; // TODO: Implement
}
```
