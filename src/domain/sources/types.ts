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
