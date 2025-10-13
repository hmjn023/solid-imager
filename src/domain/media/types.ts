/**
 * Media Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

import type { UUID } from "~/domain/shared/types";

export type MediaUpdateData = {
  filename?: string;
  description?: string;
  sourceUrl?: string;
  tags?: string[]; // Assuming tags are passed as string names for update
};

export type MediaMetadata = {
  prompt?: object;
  workflow?: object;
  parameters?: string;
  extractedTags?: string[]; // Add extracted tags
  [key: string]: unknown;
};

export type MediaSearchParams = Record<string, string | number | boolean>;

export type UploadRequest = {
  file: File;
  filename?: string;
  autoIncrement?: boolean;
  description?: string;
  sourceUrl?: string;
  overwrite?: boolean;
};

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

export type BulkEditMediaUpdates = {
  description?: string;
  sourceUrl?: string;
  tags?: string[];
  // Add other fields that can be bulk edited
};

export type BulkTagMediaOptions = {
  tagsToAdd?: number[]; // Assuming tag IDs
  tagsToRemove?: number[]; // Assuming tag IDs
};

export type AddMediaToCollectionRequest = {
  mediaId: UUID;
  displayOrder?: number;
};
