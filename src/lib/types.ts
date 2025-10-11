export type UUID = string;

export type MediaSourceTypeEnum = "local" | "sftp" | "s3";

export type ConnectionInfo =
  | LocalConnectionInfo
  | SftpConnection
  | S3Connection;

export type LocalConnectionInfo = {
  path: string;
};

export type SftpConnection = {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;
};

export type S3Connection = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
};

export type MediaSourceInfo = {
  id?: string;
  name: string;
  description: string | null;
  type: MediaSourceTypeEnum;
  connectionInfo: ConnectionInfo;
};

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
  [key: string]: any;
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

export type SearchOptions = {
  tags?: string[];
  filename?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  // Add other search parameters as needed, e.g., for metadata
  [key: string]: any;
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

export type FileSystemEvent = {
  type: "added" | "deleted" | "modified";
  sourceId: string;
  filePath: string;
  timestamp: Date;
};

export type CreateDirectoryRequest = {
  path: string;
  name: string;
  recursive?: boolean;
};

export type DeleteDirectoryRequest = {
  path: string;
  force?: boolean;
};

export type UpdateDirectoryRequest = {
  oldPath: string;
  newPath: string;
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

export type ImportData = {
  url?: string;
  file?: File;
  data?: any; // For direct data payload
};

export type CloneSourceRequest = {
  newName: string;
};

export type CategoryData = {
  name: string;
  description?: string;
  color?: string;
  parentId?: number;
};

export type CharacterData = {
  name: string;
  ipId?: number;
  description?: string;
};

export type IpData = {
  name: string;
  description?: string;
};

export type UserData = {
  name: string;
  email: string;
  password?: string;
};

export type CollectionData = {
  userId: UUID;
  name: string;
  description?: string;
};

export type AddMediaToCollectionRequest = {
  mediaId: UUID;
  displayOrder?: number;
};
