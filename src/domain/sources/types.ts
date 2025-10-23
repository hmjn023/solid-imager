/**
 * Sources Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the type of a media source.
 */
export type MediaSourceTypeEnum = "local" | "sftp" | "s3";

/**
 * Represents the connection information for a local media source.
 */
export type LocalConnectionInfo = {
  /**
   * The file system path to the media source.
   */
  path: string;
};

/**
 * Represents the connection information for an SFTP media source.
 */
export type SftpConnection = {
  /**
   * The hostname or IP address of the SFTP server.
   */
  host: string;
  /**
   * The port number of the SFTP server.
   */
  port: number;
  /**
   * The username for authentication.
   */
  username: string;
  /**
   * The password for authentication (optional).
   */
  password?: string;
  /**
   * The private key for authentication (optional).
   */
  privateKey?: string;
  /**
   * The remote path on the SFTP server.
   */
  remotePath: string;
};

/**
 * Represents the connection information for an S3 media source.
 */
export type S3Connection = {
  /**
   * The AWS region of the S3 bucket.
   */
  region: string;
  /**
   * The name of the S3 bucket.
   */
  bucket: string;
  /**
   * The AWS access key ID.
   */
  accessKeyId: string;
  /**
   * The AWS secret access key.
   */
  secretAccessKey: string;
  /**
   * An optional prefix (folder) within the S3 bucket.
   */
  prefix?: string;
};

/**
 * A union type representing all possible connection information types.
 */
export type ConnectionInfo =
  | LocalConnectionInfo
  | SftpConnection
  | S3Connection;

/**
 * Represents the information about a media source.
 */
export type MediaSourceInfo = {
  /**
   * The unique identifier of the media source.
   */
  id?: string;
  /**
   * The name of the media source.
   */
  name: string;
  /**
   * An optional description of the media source.
   */
  description: string | null;
  /**
   * The type of the media source.
   */
  type: MediaSourceTypeEnum;
  /**
   * The connection information for the media source.
   */
  connectionInfo: ConnectionInfo;
};

/**
 * Represents a file system event.
 */
export type FileSystemEvent = {
  /**
   * The type of the event.
   */
  type: "added" | "deleted" | "modified";
  /**
   * The ID of the media source where the event occurred.
   */
  sourceId: string;
  /**
   * The path of the file that was affected.
   */
  filePath: string;
  /**
   * The timestamp of the event.
   */
  timestamp: Date;
};

/**
 * Represents a request to create a new directory.
 */
export type CreateDirectoryRequest = {
  /**
   * The parent path where the new directory should be created.
   */
  path: string;
  /**
   * The name of the new directory.
   */
  name: string;
  /**
   * Whether to create parent directories if they don't exist.
   */
  recursive?: boolean;
};

/**
 * Represents a request to delete a directory.
 */
export type DeleteDirectoryRequest = {
  /**
   * The path of the directory to delete.
   */
  path: string;
  /**
   * Whether to forcefully delete the directory and its contents.
   */
  force?: boolean;
};

/**
 * Represents a request to update a directory (e.g., rename or move).
 */
export type UpdateDirectoryRequest = {
  /**
   * The original path of the directory.
   */
  oldPath: string;
  /**
   * The new path for the directory.
   */
  newPath: string;
};

/**
 * Represents a request to clone an existing media source.
 */
export type CloneSourceRequest = {
  /**
   * The new name for the cloned source.
   */
  newName: string;
};
