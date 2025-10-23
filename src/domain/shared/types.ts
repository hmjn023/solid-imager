/**
 * Shared Domain Types
 * Cross-domain types used across multiple domains
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents a universally unique identifier (UUID).
 */
export type Uuid = string;

/**
 * Represents the application's configuration settings.
 */
export type AppConfig = {
  /**
   * Server configuration settings.
   */
  server?: {
    /**
     * The port the server will listen on.
     */
    port?: number;
    /**
     * The hostname the server will bind to.
     */
    host?: string;
  };
  /**
   * Media-related configuration settings.
   */
  media?: {
    /**
     * An array of supported media formats.
     */
    supportedFormats?: string[];
    /**
     * An array of thumbnail sizes to generate.
     */
    thumbnailSizes?: number[];
    /**
     * The directory to cache thumbnails in.
     */
    cacheDirectory?: string;
    /**
     * Whether to automatically generate thumbnails.
     */
    autoGenerate?: boolean;
    /**
     * The maximum number of concurrent thumbnail generation jobs.
     */
    maxConcurrentJobs?: number;
  };
  /**
   * Upload-related configuration settings.
   */
  upload?: {
    /**
     * The maximum allowed file size for uploads in bytes.
     */
    maxFileSize?: number;
    /**
     * Whether to allow overwriting existing files on upload.
     */
    allowOverwrite?: boolean;
  };
  /**
   * Allows for other arbitrary configuration properties.
   */
  [key: string]: unknown;
};

/**
 * Represents the options for searching media.
 */
export type SearchOptions = {
  /**
   * An array of tags to filter by.
   */
  tags?: string[];
  /**
   * A filename or partial filename to search for.
   */
  filename?: string;
  /**
   * The date range to filter by.
   */
  dateRange?: {
    /**
     * The start of the date range.
     */
    from?: Date;
    /**
     * The end of the date range.
     */
    to?: Date;
  };
  /**
   * Allows for other arbitrary search parameters.
   * @remarks Add other search parameters as needed, e.g., for metadata.
   */
  [key: string]: unknown;
};

/**
 * Represents data to be imported.
 */
export type ImportData = {
  /**
   * The URL to import data from.
   */
  url?: string;
  /**
   * The file to import data from.
   */
  file?: File;
  /**
   * A direct data payload to be imported.
   */
  data?: unknown;
};

/**
 * Represents user data.
 */
export type UserData = {
  /**
   * The user's name.
   */
  name: string;
  /**
   * The user's email address.
   */
  email: string;
  /**
   * The user's password (should be handled securely and not stored in plain text).
   */
  password?: string;
};

/**
 * Represents data for a collection.
 */
export type CollectionData = {
  /**
   * The ID of the user who owns the collection.
   */
  userId: Uuid;
  /**
   * The name of the collection.
   */
  name: string;
  /**
   * An optional description of the collection.
   */
  description?: string;
};
