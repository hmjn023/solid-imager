# TSDoc未付与の可能性箇所リスト

## `src/domain` ディレクトリ

*   **`src/domain/categories/types.ts`**
    *   `export type CategoryData` - TSDocがありません。
*   **`src/domain/characters/types.ts`**
    *   `export type CharacterData` - TSDocがありません。
*   **`src/domain/ips/types.ts`**
    *   `export type IpData` - TSDocがありません。
*   **`src/domain/media/processing/image-processor.ts`**
    *   `export const ImageProcessor` - TSDocがありません。
    *   `export const VideoProcessor` - TSDocがありません。
    *   `export const AudioProcessor` - TSDocがありません。
    *   `export const WorkflowTagExtractor` - TSDocがありません。
*   **`src/domain/media/schemas.ts`**
    *   `export const mediaTypeSchema` - TSDocがありません。
    *   `export const addMediaRequestSchema` - TSDocがありません。
    *   `export const updateMediaRequestSchema` - TSDocがありません。
    *   `export const mediaIdSchema` - TSDocがありません。
    *   `export const sourceIdSchema` - TSDocがありません。
    *   `export const directoryPathSchema` - TSDocがありません。
*   **`src/domain/media/types.ts`**
    *   `export type MediaUpdateData` - TSDocがありません。
    *   `export type MediaMetadata` - TSDocがありません。
    *   `export type MediaSearchParams` - TSDocがありません。
    *   `export type UploadRequest` - TSDocがありません。
    *   `export type ThumbnailProgress` - TSDocがありません。
    *   `export type BulkEditMediaUpdates` - TSDocがありません。
    *   `export type BulkTagMediaOptions` - TSDocがありません。
    *   `export type AddMediaToCollectionRequest` - TSDocがありません。
*   **`src/domain/media/utils/hash-utils.ts`**
    *   `export const HashUtils` - TSDocがありません。
*   **`src/domain/media/utils/path-utils.ts`**
    *   `export const PathUtils` - TSDocがありません。
*   **`src/domain/shared/types.ts`**
    *   `export type Uuid` - TSDocがありません。
    *   `export type AppConfig` - TSDocがありません。
    *   `export type SearchOptions` - TSDocがありません。
    *   `export type ImportData` - TSDocがありません。
    *   `export type UserData` - TSDocがありません。
    *   `export type CollectionData` - TSDocがありません。
*   **`src/domain/shared/validation.ts`**
    *   `export const SchemaValidator` - TSDocがありません。
*   **`src/domain/sources/schemas.ts`**
    *   `export const sourceIdSchema` - TSDocがありません。
    *   `export const localConnectionSchema` - TSDocがありません。
*   **`src/domain/sources/types.ts`**
    *   `export type MediaSourceTypeEnum` - TSDocがありません。
    *   `export type LocalConnectionInfo` - TSDocがありません。
    *   `export type SftpConnection` - TSDocがありません。
    *   `export type S3Connection` - TSDocがありません。
    *   `export type ConnectionInfo` - TSDocがありません。
    *   `export type MediaSourceInfo` - TSDocがありません。
    *   `export type FileSystemEvent` - TSDocがありません。
    *   `export type CreateDirectoryRequest` - TSDocがありません。
    *   `export type DeleteDirectoryRequest` - TSDocがありません。
    *   `export type UpdateDirectoryRequest` - TSDocがありません。
    *   `export type CloneSourceRequest` - TSDocがありません。

## `src/components` ディレクトリ

*   **`src/components/ui/button.tsx`**
    *   `export { Button, buttonVariants }` - TSDocがありません。
    *   `export type { ButtonProps }` - TSDocがありません。
*   **`src/components/ui/input.tsx`**
    *   `export type InputProps` - TSDocがありません。
    *   `export function Input` - TSDocがありません。

## `src/routes` ディレクトリ

多数のAPIルートファイル（`GET`, `POST`, `PUT`, `DELETE`関数）でTSDocがありません。

## `src/application/services` ディレクトリ

*   `AnalyticsService` - TSDocがありません。
*   `BulkOperationService` - TSDocがありません。
*   `CategoryService` - TSDocがありません。
*   `CharacterService` - TSDocがありません。
*   `CollectionService` - TSDocがありません。
*   `ConfigService` - `AppConfig`型とメソッドにTSDocがありません。
*   `DataMigrationService` - TSDocがありません。
*   `DirectoryService` - メソッドにTSDocがありません。
*   `EventService` - メソッドにTSDocがありません。
*   `FilterPresetService` - メソッドにTSDocがありません。
*   `IntegrationService` - メソッドにTSDocがありません。
*   `IpService` - メソッドにTSDocがありません。
*   `MediaService` - メソッドにTSDocがありません。
*   `MediaSourceService` - `FetchError`, `CreateSourceData`, `UpdateSourceData`型とメソッドにTSDocがありません。
*   `SearchService` - `SearchOptions`型とメソッドにTSDocがありません。
*   `ThumbnailService` - メソッドにTSDocがありません。
*   `UserService` - メソッドにTSDocがありません。
*   `WorkflowService` - メソッドにTSDocがありません。

## `src/infrastructure` ディレクトリ

*   **`src/infrastructure/api-clients`**
    *   `categories.ts` - すべての関数にTSDocがありません。
    *   `characters.ts` - すべての関数にTSDocがありません。
    *   `config.ts` - すべての関数にTSDocがありません。
    *   `directories.ts` - すべての関数にTSDocがありません。
    *   `events.ts` - 関数にTSDocがありません。
    *   `ips.ts` - すべての関数にTSDocがありません。
    *   `media.ts` - すべての関数にTSDocがありません。
    *   `sources.ts` - すべての関数にTSDocがありません。
    *   `tags.ts` - すべての関数にTSDocがありません。
    *   `thumbnails.ts` - すべての関数にTSDocがありません。
*   **`src/infrastructure/db/`**
    *   `schema.ts`: 多数のテーブル定義、リレーション定義、型定義でTSDocがありません。一部のコメントは日本語であり、TSDoc形式ではありません。
    *   `data-migration.ts`, `errors.ts`, `index.ts`: JSDoc/TSDocの型指定に関する問題は見つかりませんでした。
*   **`src/infrastructure/db/queries/`**
    *   `bulk-operations.ts` - すべての関数にTSDocがありません。
    *   `categories.ts` - すべての関数にTSDocがありません。
    *   `characters.ts` - すべての関数にTSDocがありません。
    *   `collections.ts` - すべての関数にTSDocがありません。
    *   `ips.ts` - すべての関数にTSDocがありません。
    *   `jobs.ts` - 関数にTSDocがありません。
    *   `media-generation-info.ts` - すべての関数にTSDocがありません。
    *   `media-random.ts` - `Media`型と関数にTSDocがありません。
    *   `media-recent.ts` - 関数にTSDocがありません。
    *   `media-sources.ts` - すべての関数にTSDocがありません。
    *   `media.ts` - すべての関数にTSDocがありません。
    *   `presets.ts` - `Preset`型と関数にTSDocがありません。
    *   `search.ts` - すべての関数にTSDocがありません。
    *   `tags.ts` - 関数にTSDocがありません。
    *   `users.ts` - すべての関数にTSDocがありません。
*   **`src/infrastructure/jobs`**
    *   `job-queue.ts` - `JobQueue`オブジェクトとメソッドにTSDocがありません。
    *   `sse-manager.ts` - `SseManager`オブジェクトとメソッドにTSDocがありません。
    *   `thumbnail-jobs.ts` - `ThumbnailJob`, `JobStats`型とすべての関数にTSDocがありません。
    *   `thumbnails.ts` - `ensureCacheDir`, `getThumbnailPath`関数にTSDocがありません。`generateThumbnail`, `deleteThumbnail`, `generateThumbnailsForSource`関数には日本語のコメントがありますが、TSDoc形式ではありません。
*   **`src/infrastructure/storage`**
    *   `factory.ts` - `getDriver`関数に日本語のコメントがありますが、TSDoc形式ではありません。
    *   `local.ts` - `LocalDriver`クラスとメソッドにTSDocがありません。`testConnection`メソッドには日本語のコメントがあります。
    *   `s3.ts` - `S3Driver`オブジェクトとメソッドにTSDocがありません。
    *   `sftp.ts` - `SftpDriver`オブジェクトとメソッドにTSDocがありません。
    *   `types.ts` - `ConnectionInfo`, `MediaSourceEntry`型にTSDocがありません。`MediaSourceDriver`インターフェースとメソッドに日本語のコメントがありますが、TSDoc形式ではありません。

## `src/tests` ディレクトリ

*   **`src/tests/api/categories/index.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/categories/category-id-test.ts`**: テスト変数とモックデータにTSDocがありません。

# JSDoc/TSDoc 型情報が不十分な箇所の詳細リスト

## `src/routes/api/categories/`

*   **`index.ts`**
    *   `GET` 関数: `@returns` の型指定がありません。
    *   `POST` 関数: `@returns` の型指定がありません。
*   **`[id].ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
    *   `PUT` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
    *   `DELETE` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

## `src/routes/api/charactors/`

*   **`index.ts`**
    *   `GET` 関数: `@returns` の型指定がありません。
    *   `POST` 関数: `@returns` の型指定がありません。
*   **`[id].ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
    *   `PUT` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
    *   `DELETE` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

## `src/routes/api/ips/`

*   **`index.ts`**
    *   `GET` 関数: `@returns` の型指定がありません。
    *   `POST` 関数: `@returns` の型指定がありません。
*   **`[id].ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
    *   `PUT` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
    *   `DELETE` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

## `src/routes/api/sources/`

*   **`index.ts`**
    *   `GET` 関数: `@returns` の型指定がありません。
    *   `POST` 関数: `@returns` の型指定がありません。

### `[sourceId]/`

*   **`events.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`index.ts`**
    *   `GET`, `PUT`, `DELETE` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`search.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`status.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

#### `[mediaId]/`

*   **`charactors.ts`**
    *   `GET` 関数: `@returns` の型指定がありません。
*   **`details.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`index.ts`**
    *   `GET`, `PUT` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`ips.ts`**
    *   `GET` 関数: `@returns` の型指定がありません。
*   **`metadata.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`tags.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`thumbnail.ts`**
    *   `GET` 関数: TSDocがありません。
*   **`upload.ts`**
    *   `POST` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

#### `directories/`

*   **`create.ts`**
    *   `POST` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`delete.ts`**
    *   `DELETE` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`index.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`rename.ts`**
    *   `PUT` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

##### `[...directories]/`

*   **`index.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`search.ts`**
    *   `GET` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

#### `thumbnails/`

*   **`index.ts`**
    *   `POST`, `DELETE` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。

## `src/routes/api/tags/`

*   **`[id].ts`**
    *   `GET`, `PUT`, `DELETE` 関数: `@param` の型指定が不適切な形式です。`@returns` の型指定がありません。
*   **`index.ts`**
    *   `GET`, `POST` 関数: `@returns` の型指定がありません。

## `src/application/services` ディレクトリ

*   `AnalyticsService` - TSDocがありません。
*   `BulkOperationService` - TSDocがありません。
*   `CategoryService` - TSDocがありません。
*   `CharacterService` - TSDocがありません。
*   `CollectionService` - TSDocがありません。
*   `ConfigService` - `AppConfig`型とメソッドにTSDocがありません。
*   `DataMigrationService` - TSDocがありません。
*   `DirectoryService` - メソッドにTSDocがありません。
*   `EventService` - メソッドにTSDocがありません。
*   `FilterPresetService` - メソッドにTSDocがありません。
*   `IntegrationService` - メソッドにTSDocがありません。
*   `IpService` - メソッドにTSDocがありません。
*   `MediaService` - メソッドにTSDocがありません。
*   `MediaSourceService` - `FetchError`, `CreateSourceData`, `UpdateSourceData`型とメソッドにTSDocがありません。
*   `SearchService` - `SearchOptions`型とメソッドにTSDocがありません。
*   `ThumbnailService` - メソッドにTSDocがありません。
*   `UserService` - メソッドにTSDocがありません。
*   `WorkflowService` - メソッドにTSDocがありません。

## `src/infrastructure` ディレクトリ

*   **`src/infrastructure/api-clients`**
    *   `categories.ts` - すべての関数にTSDocがありません。
    *   `characters.ts` - すべての関数にTSDocがありません。
    *   `config.ts` - すべての関数にTSDocがありません。
    *   `directories.ts` - すべての関数にTSDocがありません。
    *   `events.ts` - 関数にTSDocがありません。
    *   `ips.ts` - すべての関数にTSDocがありません。
    *   `media.ts` - すべての関数にTSDocがありません。
    *   `sources.ts` - すべての関数にTSDocがありません。
    *   `tags.ts` - すべての関数にTSDocがありません。
    *   `thumbnails.ts` - すべての関数にTSDocがありません。
*   **`src/infrastructure/db/`**
    *   `schema.ts`: 多数のテーブル定義、リレーション定義、型定義でTSDocがありません。一部のコメントは日本語であり、TSDoc形式ではありません。
    *   `data-migration.ts`, `errors.ts`, `index.ts`: JSDoc/TSDocの型指定に関する問題は見つかりませんでした。
*   **`src/infrastructure/db/queries/`**
    *   `bulk-operations.ts` - すべての関数にTSDocがありません。
    *   `categories.ts` - すべての関数にTSDocがありません。
    *   `characters.ts` - すべての関数にTSDocがありません。
    *   `collections.ts` - すべての関数にTSDocがありません。
    *   `ips.ts` - すべての関数にTSDocがありません。
    *   `jobs.ts` - 関数にTSDocがありません。
    *   `media-generation-info.ts` - すべての関数にTSDocがありません。
    *   `media-random.ts` - `Media`型と関数にTSDocがありません。
    *   `media-recent.ts` - 関数にTSDocがありません。
    *   `media-sources.ts` - すべての関数にTSDocがありません。
    *   `media.ts` - すべての関数にTSDocがありません。
    *   `presets.ts` - `Preset`型と関数にTSDocがありません。
    *   `search.ts` - すべての関数にTSDocがありません。
    *   `tags.ts` - 関数にTSDocがありません。
    *   `users.ts` - すべての関数にTSDocがありません。
*   **`src/infrastructure/jobs`**
    *   `job-queue.ts` - `JobQueue`オブジェクトとメソッドにTSDocがありません。
    *   `sse-manager.ts` - `SseManager`オブジェクトとメソッドにTSDocがありません。
    *   `thumbnail-jobs.ts` - `ThumbnailJob`, `JobStats`型とすべての関数にTSDocがありません。
    *   `thumbnails.ts` - `ensureCacheDir`, `getThumbnailPath`関数にTSDocがありません。`generateThumbnail`, `deleteThumbnail`, `generateThumbnailsForSource`関数には日本語のコメントがありますが、TSDoc形式ではありません。
*   **`src/infrastructure/storage`**
    *   `factory.ts` - `getDriver`関数に日本語のコメントがありますが、TSDoc形式ではありません。
    *   `local.ts` - `LocalDriver`クラスとメソッドにTSDocがありません。`testConnection`メソッドには日本語のコメントがあります。
    *   `s3.ts` - `S3Driver`オブジェクトとメソッドにTSDocがありません。
    *   `sftp.ts` - `SftpDriver`オブジェクトとメソッドにTSDocがありません。
    *   `types.ts` - `ConnectionInfo`, `MediaSourceEntry`型にTSDocがありません。`MediaSourceDriver`インターフェースとメソッドに日本語のコメントがありますが、TSDoc形式ではありません。

## `src/tests` ディレクトリ

*   **`src/tests/api/categories/index.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/categories/category-id-test.ts`**: テスト変数とモックデータにTSDocがありません。
