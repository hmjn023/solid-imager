/**
 * Sources Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

export type MediaSourceTypeEnum = "local" | "sftp" | "s3";

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

export type ConnectionInfo =
  | LocalConnectionInfo
  | SftpConnection
  | S3Connection;

export type MediaSourceInfo = {
  id?: string;
  name: string;
  description: string | null;
  type: MediaSourceTypeEnum;
  connectionInfo: ConnectionInfo;
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

export type CloneSourceRequest = {
  newName: string;
};
