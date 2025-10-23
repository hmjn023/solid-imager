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
    *   `data-migration.ts` - `ImportData`型と関数にTSDocがありません。
    *   `errors.ts` - カスタムエラークラスにTSDocがありません。
    *   `index.ts` - `db`定数と`initializeDb`関数にTSDocがありません。
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
*   **`src/tests/api/characters/index.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/characters/character-id-test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/ips/index.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/ips/ip-id-test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/media/add-media.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/media/delete-media.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/media/get-media.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/media/list-media.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/media/update-media.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/sources/[sourceId]/[mediaId]/charactors.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/sources/[sourceId]/[mediaId]/details.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/sources/[sourceId]/[mediaId]/ips.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/sources/[sourceId]/[mediaId]/metadata.test.ts`**: テスト変数とモックデータにTSDocがありません。
*   **`src/tests/api/sources/[sourceId]/[mediaId]/tags.test.ts`**: テスト変数とモックデータにTSDocがありません。

# 未調査のディレクトリとファイル

以下は、TSDocコメントの有無を明示的に調査していないファイルとディレクトリです。

*   `src/app.css` (CSSファイルなのでTSDocは適用されません)
*   `src/app.tsx` (デフォルト関数`App`と`queryClient`定数にTSDocがありません)
*   `src/entry-client.tsx` (デフォルト関数`mountApp`にTSDocがありません)
*   `src/entry-server.tsx` (デフォルト関数にTSDocがありません)
*   `src/global.d.ts` (宣言ファイルなので、宣言自体にTSDocは適用されません)
*   `src/components/counter.tsx` (デフォルト関数`Counter`にTSDocがありません)
*   `src/components/nav.tsx` (デフォルト関数`Nav`にTSDocがありません)
*   `src/components/simple-modal.tsx` (デフォルト関数`SimpleModal`にTSDocがありません)
*   `src/components/source-card.tsx` (デフォルト関数`SourceCard`と`SourceCardProps`型にTSDocがありません)
*   `src/components/source-delete-modal.tsx` (デフォルト関数`SourceDeleteModal`と`SourceDeleteModalProps`型にTSDocがありません)
*   `src/components/source-form-modal.tsx` (デフォルト関数`SourceFormModal`と`SourceFormModalProps`型にTSDocがありません)
*   `src/routes/[...404].tsx` (デフォルト関数`NotFound`にTSDocがありません)
*   `src/routes/about.tsx` (デフォルト関数`About`にTSDocがありません)
*   `src/routes/index.tsx` (デフォルト関数`Home`にTSDocがありません)
*   `src/routes/sources.tsx` (デフォルト関数`Sources`とヘルパー関数/定数にTSDocがありません)
*   `src/tests/api/tags` (ディレクトリ)
*   `src/tests/db` (ディレクトリ)
*   `src/tests/e2e` (ディレクトリ)
*   `src/tests/integration` (ディレクトリ)
*   `src/tests/unit` (ディレクトリ)
*   `src/tests/setup-integration.ts`
*   `src/tests/setup-unit.ts`
*   `src/tests/setup.ts`