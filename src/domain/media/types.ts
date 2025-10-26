/**
 * Media Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

import type { UUID } from "~/domain/shared/types";

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
  tagsToAdd?: number[]; // Assuming tag IDs
  tagsToRemove?: number[]; // Assuming tag IDs
};

/**
 * Represents the request body for adding a media item to a collection.
 * @property {UUID} mediaId - The UUID of the media item to add.
 * @property {number} [displayOrder] - An optional display order for the media within the collection.
 */
export type AddMediaToCollectionRequest = {
  mediaId: UUID;
  displayOrder?: number;
};
