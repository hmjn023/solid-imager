/**
 * Media Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

import type { UUID } from "~/domain/shared/types";

/**
 * Represents the data for updating a media entry.
 */
export type MediaUpdateData = {
  /**
   * The new filename for the media.
   */
  filename?: string;
  /**
   * The new description for the media.
   */
  description?: string;
  /**
   * The new source URL for the media.
   */
  sourceUrl?: string;
  /**
   * An array of tags to associate with the media.
   * @remarks Assuming tags are passed as string names for update.
   */
  tags?: string[];
};

/**
 * Represents the metadata associated with a media file.
 */
export type MediaMetadata = {
  /**
   * The prompt used to generate the media (if applicable).
   */
  prompt?: object;
  /**
   * The workflow used to generate the media (if applicable).
   */
  workflow?: object;
  /**
   * Additional parameters used for generation.
   */
  parameters?: string;
  /**
   * Tags extracted from the media's metadata.
   */
  extractedTags?: string[];
  /**
   * Allows for other arbitrary metadata properties.
   */
  [key: string]: unknown;
};

/**
 * Represents the parameters for searching media.
 */
export type MediaSearchParams = Record<string, string | number | boolean>;

/**
 * Represents a request to upload a new media file.
 */
export type UploadRequest = {
  /**
   * The file to be uploaded.
   */
  file: File;
  /**
   * An optional new filename for the uploaded file.
   */
  filename?: string;
  /**
   * Whether to automatically increment the filename if a conflict exists.
   */
  autoIncrement?: boolean;
  /**
   * An optional description for the media.
   */
  description?: string;
  /**
   * An optional source URL for the media.
   */
  sourceUrl?: string;
  /**
   * Whether to overwrite an existing file with the same name.
   */
  overwrite?: boolean;
};

/**
 * Represents the progress of a thumbnail generation process.
 */
export type ThumbnailProgress = {
  /**
   * The type of the progress event.
   */
  type: "thumbnail_progress";
  /**
   * The ID of the media source being processed.
   */
  sourceId: string;
  /**
   * The current status of the thumbnail generation.
   */
  status: "started" | "processing" | "completed" | "error";
  /**
   * The progress details.
   */
  progress: {
    /**
     * The number of items processed so far.
     */
    current: number;
    /**
     * The total number of items to process.
     */
    total: number;
    /**
     * The file currently being processed.
     */
    currentFile?: string;
  };
  /**
   * An error message if the process failed.
   */
  error?: string;
};

/**
 * Represents the updates to be applied to multiple media entries in bulk.
 */
export type BulkEditMediaUpdates = {
  /**
   * The new description to apply.
   */
  description?: string;
  /**
   * The new source URL to apply.
   */
  sourceUrl?: string;
  /**
   * The new set of tags to apply.
   */
  tags?: string[];
  // Add other fields that can be bulk edited
};

/**
 * Represents the options for bulk tagging of media.
 */
export type BulkTagMediaOptions = {
  /**
   * An array of tag IDs to add.
   */
  tagsToAdd?: number[];
  /**
   * An array of tag IDs to remove.
   */
  tagsToRemove?: number[];
};

/**
 * Represents a request to add a media entry to a collection.
 */
export type AddMediaToCollectionRequest = {
  /**
   * The ID of the media to add.
   */
  mediaId: UUID;
  /**
   * The display order of the media within the collection.
   */
  displayOrder?: number;
};
