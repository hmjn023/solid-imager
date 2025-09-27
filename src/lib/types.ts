export type MediaSourceTypeEnum = "local" | "sftp" | "s3";

export type ConnectionInfo = LocalConnectionInfo;

export type LocalConnectionInfo = {
  path: string;
};

export type MediaSourceInfo = {
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

export type MediaUpdateData = Record<string, unknown>;

export type MediaSearchParams = Record<string, string | number | boolean>;
