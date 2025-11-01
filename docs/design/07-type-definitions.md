# 型定義

このドキュメントでは、アプリケーション全体で使用される主要な型定義を記述します。

## 型定義の配置

このプロジェクトはクリーンアーキテクチャを採用しており、型定義はドメインごとに分散配置されています：

- **ドメイン型**: `src/domain/{domain}/types.ts`
  - `src/domain/media/types.ts` - メディア関連の型
  - `src/domain/sources/types.ts` - メディアソース関連の型
  - `src/domain/tags/types.ts` - タグ関連の型
  - `src/domain/categories/types.ts` - カテゴリ関連の型
  - `src/domain/characters/types.ts` - キャラクター関連の型
  - `src/domain/ips/types.ts` - IP（知的財産）関連の型
  - `src/domain/shared/types.ts` - 共通型（Uuid, AppConfig等）
- **インフラストラクチャ型**: `src/infrastructure/{layer}/types.ts`
  - `src/infrastructure/storage/types.ts` - ストレージドライバー関連の型
- **検証スキーマ**: `src/domain/{domain}/schemas.ts`
  - Zodスキーマによる実行時の型検証

この分散配置により、各ドメインの独立性が保たれ、変更の影響範囲が限定されます。

---

## `src/domain/shared/types.ts`

```typescript
/**
 * Shared Domain Types
 * Cross-domain types used across multiple domains
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents a universally unique identifier (UUID) as a string.
 */
export type Uuid = string;
/**
 * Represents the application's configuration structure.
 * @property {object} [server] - Server-related settings.
 * @property {number} [server.port] - The port number the server listens on.
 * @property {string} [server.host] - The host address the server binds to.
 * @property {object} [media] - Media processing settings.
 * @property {string[]} [media.supportedFormats] - Array of supported media file formats.
 * @property {number[]} [media.thumbnailSizes] - Array of desired thumbnail sizes.
 * @property {string} [media.cacheDirectory] - Directory for storing media caches.
 * @property {boolean} [media.autoGenerate] - Whether to auto-generate thumbnails on source addition.
 * @property {number} [media.maxConcurrentJobs] - Maximum number of concurrent media processing jobs.
 * @property {object} [upload] - Upload-related settings.
 * @property {number} [upload.maxFileSize] - Maximum allowed file size for uploads in bytes.
 * @property {boolean} [upload.allowOverwrite] - Whether to allow overwriting existing files during upload.
 * @property {unknown} [key: string] - Allows for future expansion with additional configuration fields.
 */
export type AppConfig = {
  server?: {
    port?: number;
    host?: string;
  };
  media?: {
    supportedFormats?: string[];
    thumbnailSizes?: number[];
    cacheDirectory?: string;
    autoGenerate?: boolean;
    maxConcurrentJobs?: number;
  };
  upload?: {
    maxFileSize?: number;
    allowOverwrite?: boolean;
  };
  [key: string]: unknown;
};
/**
 * Defines the options available for searching media.
 * @property {string[]} [tags] - An array of tags to filter the search results.
 * @property {string} [filename] - A partial filename to search for.
 * @property {object} [dateRange] - A date range for filtering media by creation or modification date.
 * @property {Date} [dateRange.from] - The start date of the range.
 * @property {Date} [dateRange.to] - The end date of the range.
 * @property {unknown} [key: string] - Allows for future expansion with additional search parameters.
 */
export type SearchOptions = {
  tags?: string[];
  filename?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  // Add other search parameters as needed, e.g., for metadata
  [key: string]: unknown;
};

/**
 * Represents data for importing media, which can be from a URL, a file, or direct data payload.
 * @property {string} [url] - The URL from which to import media.
 * @property {File} [file] - The file object to import.
 * @property {unknown} [data] - A direct data payload to import.
 */
export type ImportData = {
  url?: string;
  file?: File;
  data?: unknown; // For direct data payload
};

/**
 * Represents the data structure for a user.
 * @property {string} name - The name of the user.
 * @property {string} email - The email address of the user, which must be unique.
 * @property {string} [password] - The user's password (should be handled securely and not exposed).
 */
export type UserData = {
  name: string;
  email: string;
  password?: string;
};

/**
 * Represents the data structure for a media collection.
 * @property {Uuid} userId - The UUID of the user who owns the collection.
 * @property {string} name - The name of the collection.
 * @property {string} [description] - An optional description for the collection.
 */
export type CollectionData = {
  userId: Uuid;
  name: string;
  description?: string;
};
```

## `src/domain/sources/types.ts`

```typescript
/**
 * Sources Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Defines the possible types of media sources.
 * - 'local': Files are stored on the local file system.
 * - 'sftp': Files are accessed via an SFTP connection.
 * - 's3': Files are stored in an AWS S3 bucket.
 */
export type MediaSourceTypeEnum = "local" | "sftp" | "s3";
/**
 * Represents connection information for a local media source.
 * @property {string} path - The absolute file system path to the local media directory.
 */
export type LocalConnectionInfo = {
  path: string;
};
/**
 * Represents connection information for an SFTP media source.
 * @property {string} host - The SFTP server hostname or IP address.
 * @property {number} port - The port number for the SFTP connection.
 * @property {string} username - The username for SFTP authentication.
 * @property {string} [password] - The password for SFTP authentication (optional, if privateKey is used).
 * @property {string} [privateKey] - The private key for SFTP authentication (optional, if password is used).
 * @property {string} remotePath - The remote path on the SFTP server where media files are stored.
 */
export type SftpConnection = {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;
};
/**
 * Represents connection information for an AWS S3 media source.
 * @property {string} region - The AWS region where the S3 bucket is located.
 * @property {string} bucket - The name of the S3 bucket.
 * @property {string} accessKeyId - The AWS access key ID for authentication.
 * @property {string} secretAccessKey - The AWS secret access key for authentication.
 * @property {string} [prefix] - An optional prefix to filter objects within the S3 bucket (e.g., a folder path).
 */
export type S3Connection = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
};
/**
 * A union type representing the connection information for any supported media source type.
 * It can be either LocalConnectionInfo, SftpConnection, or S3Connection.
 */
export type ConnectionInfo =
  | LocalConnectionInfo
  | SftpConnection
  | S3Connection;
/**
 * Represents the detailed information about a media source.
 * @property {string} [id] - The unique identifier (UUID) of the media source. Optional for creation.
 * @property {string} name - The display name of the media source.
 * @property {string | null} description - An optional description for the media source.
 * @property {MediaSourceTypeEnum} type - The type of the media source (local, sftp, s3).
 * @property {ConnectionInfo} connectionInfo - The specific connection details based on the media source type.
 */
export type MediaSourceInfo = {
  id?: string;
  name: string;
  description: string | null;
  type: MediaSourceTypeEnum;
  connectionInfo: ConnectionInfo;
};
/**
 * Represents a file system event, typically used for real-time updates via Server-Sent Events (SSE).
 * @property {"added" | "deleted" | "modified"} type - The type of file system event.
 * @property {string} sourceId - The ID of the media source where the event occurred.
 * @property {string} filePath - The relative path of the file that was affected by the event.
 * @property {Date} timestamp - The timestamp when the event occurred.
 */
export type FileSystemEvent = {
  type: "added" | "deleted" | "modified";
  sourceId: string;
  filePath: string;
  timestamp: Date;
};

/**
 * Represents the request body for creating a new directory within a media source.
 * @property {string} path - The path where the new directory should be created.
 * @property {string} name - The name of the new directory to create.
 * @property {boolean} [recursive] - If true, creates parent directories if they don't exist.
 */
export type CreateDirectoryRequest = {
  path: string;
  name: string;
  recursive?: boolean;
};

/**
 * Represents the request body for deleting a directory within a media source.
 * @property {string} path - The path of the directory to delete.
 * @property {boolean} [force] - If true, deletes the directory even if it's not empty.
 */
export type DeleteDirectoryRequest = {
  path: string;
  force?: boolean;
};

/**
 * Represents the request body for renaming or moving a directory within a media source.
 * @property {string} oldPath - The current path of the directory.
 * @property {string} newPath - The new path/name for the directory.
 */
export type UpdateDirectoryRequest = {
  oldPath: string;
  newPath: string;
};

/**
 * Represents the request body for cloning an existing media source.
 * @property {string} newName - The name for the new cloned media source.
 */
export type CloneSourceRequest = {
  newName: string;
};
```

## `src/domain/media/types.ts`

```typescript
/**
 * Media Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

import type { Uuid } from "~/domain/shared/types";

/**
 * Represents the data structure for updating media information.
 * All properties are optional, allowing for partial updates.
 * @property {string} [filename] - The new filename for the media. Renames the actual file.
 * @property {string} [description] - A new description for the media.
 * @property {string} [sourceUrl] - A new source URL for the media.
 * @property {string[]} [tags] - An array of tag names to completely replace existing tags.
 */
export type MediaUpdateData = {
  filename?: string;
  description?: string;
  sourceUrl?: string;
  tags?: string[]; // Assuming tags are passed as string names for update
};
/**
 * Represents the metadata extracted from a media file, especially for AI-generated content.
 * @property {object} [prompt] - The prompt used for AI generation, typically a JSON object.
 * @property {object} [workflow] - The workflow details for AI generation, typically a JSON object.
 * @property {string} [parameters] - Other parameters used during generation, as a string.
 * @property {string[]} [extractedTags] - Tags extracted from the metadata.
 * @property {unknown} [key: string] - Allows for future expansion with additional metadata fields.
 */
export type MediaMetadata = {
  prompt?: object;
  workflow?: object;
  parameters?: string;
  extractedTags?: string[]; // Add extracted tags
  [key: string]: unknown;
};
/**
 * Represents the parameters used for searching media.
 * This is a generic record type where keys are search fields and values are their corresponding search terms.
 */
export type MediaSearchParams = Record<string, string | number | boolean>;
/**
 * Represents the request body for uploading a media file.
 * @property {File} file - The file to be uploaded.
 * @property {string} [filename] - An optional custom filename for the uploaded file. If not provided, the original filename is used.
 * @property {boolean} [autoIncrement] - If true, enables auto-incrementing filenames to avoid conflicts (e.g., media_001.png).
 * @property {string} [description] - An optional description for the media.
 * @property {string} [sourceUrl] - An optional source URL for the media.
 * @property {boolean} [overwrite] - If true, allows overwriting an existing file with the same name.
 */
export type UploadRequest = {
  file: File;
  filename?: string;
  autoIncrement?: boolean;
  description?: string;
  sourceUrl?: string;
  overwrite?: boolean;
};
/**
 * Represents the progress of a thumbnail generation task, used for real-time updates via SSE.
 * @property {"thumbnail_progress"} type - The type of the event, always "thumbnail_progress".
 * @property {string} sourceId - The ID of the media source for which thumbnails are being generated.
 * @property {"started" | "processing" | "completed" | "error"} status - The current status of the thumbnail generation.
 * @property {object} progress - Details about the current progress.
 * @property {number} progress.current - The number of media files processed so far.
 * @property {number} progress.total - The total number of media files to process.
 * @property {string} [progress.currentFile] - The name of the file currently being processed.
 * @property {string} [error] - An optional error message if the generation failed.
 */
export type ThumbnailProgress = {
  type: "thumbnail_progress";
  sourceId: string;
  status: "started" | "processing" | "completed" | "error";
  progress: {
    current: number;
    total: number;
    currentFile?: string;
  };
  error?: string;
};

/**
 * Represents the data structure for bulk editing multiple media items.
 * All properties are optional, allowing for partial updates across multiple media.
 * @property {string} [description] - A new description to apply to all selected media.
 * @property {string} [sourceUrl] - A new source URL to apply to all selected media.
 * @property {string[]} [tags] - An array of tag names to apply to all selected media (e.g., replacing or adding).
 * // Add other fields that can be bulk edited
 */
export type BulkEditMediaUpdates = {
  description?: string;
  sourceUrl?: string;
  tags?: string[];
  // Add other fields that can be bulk edited
};

/**
 * Represents options for bulk tagging media items.
 * @property {number[]} [tagsToAdd] - An array of tag IDs to add to the selected media.
 * @property {number[]} [tagsToRemove] - An array of tag IDs to remove from the selected media.
 */
export type BulkTagMediaOptions = {
  tagsToAdd?: { tagId: number, source?: string }[]; // Assuming tag IDs
  tagsToRemove?: number[]; // Assuming tag IDs
};

/**
 * Represents the request body for adding a media item to a collection.
 * @property {Uuid} mediaId - The UUID of the media item to add.
 * @property {number} [displayOrder] - An optional display order for the media within the collection.
 */
export type AddMediaToCollectionRequest = {
  mediaId: Uuid;
  displayOrder?: number;
};
```

## `src/domain/categories/types.ts`

```typescript
/**
 * Categories Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data structure for a category.
 * @property {string} name - The name of the category.
 * @property {string} [description] - An optional description for the category.
 * @property {string} [color] - An optional color associated with the category, typically in hex format.
 * @property {number} [parentId] - An optional ID of the parent category, if this is a subcategory.
 */
export type CategoryData = {
  name: string;
  description?: string;
  color?: string;
  parentId?: number;
};
```

## `src/domain/characters/types.ts`

```typescript
/**
 * Characters Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data structure for a character.
 * @property {string} name - The name of the character.
 * @property {number} [ipId] - An optional ID of the intellectual property (IP) this character belongs to.
 * @property {string} [description] - An optional description for the character.
 */
export type CharacterData = {
  name: string;
  ipId?: number;
  description?: string;
};
```

## `src/domain/ips/types.ts`

```typescript
/**
 * IPs Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data structure for an Intellectual Property (IP).
 * @property {string} name - The name of the IP.
 * @property {string} [description] - An optional description for the IP.
 */
export type IpData = {
  name: string;
  description?: string;
};
```

## `src/domain/tags/types.ts`

```typescript
/**
 * Tags Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 * Note: No tag-specific types found in original types.ts
 * This file serves as a placeholder for future tag domain types
 */

// Placeholder for future tag types
// export type TagData = { ... };
```

## `src/infrastructure/storage/types.ts`

```typescript
/**
 * Storage Driver Types
 * Extracted from src/lib/drivers/types.ts
 */

// Note: Connection types are now in domain layer
// Import from domain instead of defining here
import type {
  LocalConnectionInfo,
  S3Connection,
  SftpConnection,
} from "~/domain/sources/types";

// すべての接続情報の方をまとめたUnion型
/**
 * A union type representing the connection information for any supported media source type.
 * It can be either LocalConnectionInfo, SftpConnection, or S3Connection.
 */
export type ConnectionInfo =
  | LocalConnectionInfo
  | SftpConnection
  | S3Connection;

// ファイルやディレクトリの基本的な情報
/**
 * Represents basic information about a file or directory within a media source.
 * @property {string} path - The full path of the entry relative to the media source's root.
 * @property {boolean} isDirectory - True if the entry is a directory, false otherwise.
 * @property {number} size - The size of the entry in bytes.
 * @property {Date} lastModified - The last modification date of the entry.
 */
export type MediaSourceEntry = {
  // フルパス
  path: string;
  // ディレクトリかどうか
  isDirectory: boolean;
  // ファイルサイズ
  size: number;
  // 更新日時
  lastModified: Date;
};

// ドライバのインターフェース定義
/**
 * Defines the interface for media source drivers.
 * Each driver is responsible for interacting with a specific type of media storage (e.g., local, SFTP, S3).
 */
export type MediaSourceDriver = {
  /**
   * Tests the connection to the media source.
   * @returns {Promise<{ success: boolean; message?: string }>} A promise that resolves with the connection test result.
   */
  testConnection(): Promise<{ success: boolean; message?: string }>;

  /**
   * Lists the contents (files and directories) of a specified path within the media source.
   * @param {string} path - The path to list.
   * @returns {Promise<MediaSourceEntry[]>} A promise that resolves with an array of MediaSourceEntry objects.
   */
  list(path: string): Promise<MediaSourceEntry[]>;

  /**
   * Retrieves the content of a file from the media source.
   * @param {string} path - The path to the file.
   * @returns {Promise<Buffer>} A promise that resolves with the file content as a Buffer.
   */
  get(path: string): Promise<Buffer>;

  /**
   * Writes content to a file within the media source.
   * @param {string} path - The path to the file.
   * @param {Buffer} content - The content to write to the file.
   * @returns {Promise<void>} A promise that resolves when the content has been written.
   */
  put(path: string, content: Buffer): Promise<void>;

  /**
   * Creates a new directory within the media source.
   * @param {string} path - The path of the directory to create.
   * @returns {Promise<void>} A promise that resolves when the directory has been created.
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Deletes a file or directory from the media source.
   * @param {string} path - The path to the file or directory to delete.
   * @returns {Promise<void>} A promise that resolves when the item has been deleted.
   */
  delete(path: string): Promise<void>;

  /**
   * Renames or moves a file or directory within the media source.
   * @param {string} oldPath - The current path of the item.
   * @param {string} newPath - The new path/name for the item.
   * @returns {Promise<void>} A promise that resolves when the item has been renamed/moved.
   */
  rename(oldPath: string, newPath: string): Promise<void>;
};
```
