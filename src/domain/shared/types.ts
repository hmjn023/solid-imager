/**
 * Shared Domain Types
 * Cross-domain types used across multiple domains
 * Extracted from src/lib/types.ts during architecture reorganization
 */

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
 * @property {UUID} userId - The UUID of the user who owns the collection.
 * @property {string} name - The name of the collection.
 * @property {string} [description] - An optional description for the collection.
 */
export type CollectionData = {
  userId: UUID;
  name: string;
  description?: string;
};
