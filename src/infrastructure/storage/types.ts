/**
 * Storage Driver Types
 * Extracted from src/lib/drivers/types.ts
 */

// Note: Connection types are now in domain layer
// Import from domain instead of defining here
import type {
  LocalConnection,
  S3Connection,
  SftpConnection,
} from "@solid-imager/core/domain/sources/schemas";

// すべての接続情報の方をまとめたUnion型
/**
 * A union type representing the connection information for any supported media source type.
 * It can be either LocalConnectionInfo, SftpConnection, or S3Connection.
 */
export type ConnectionInfo = LocalConnection | SftpConnection | S3Connection;

// ファイルやディレクトリの基本的な情報
/**
 * Represents basic information about a file or directory within a media source.
 * @property {string} path - The full path of the entry relative to the media source's root.
 * @property {boolean} isDirectory - True if the entry is a directory, false otherwise.
 * @property {number} size - The size of the entry in bytes.
 * @property {Date} lastModified - The last modification date of the entry.
 */
export type MediaSourceEntry = {
  // フルパス
  path: string;
  // ディレクトリかどうか
  isDirectory: boolean;
  // ファイルサイズ
  size: number;
  // 更新日時
  lastModified: Date;
};

// ドライバのインターフェース定義
/**
 * Defines the interface for media source drivers.
 * Each driver is responsible for interacting with a specific type of media storage (e.g., local, SFTP, S3).
 */
export type MediaSourceDriver = {
  /**
   * Tests the connection to the media source.
   * @returns {Promise<{ success: boolean; message?: string }>} A promise that resolves with the connection test result.
   */
  testConnection(): Promise<{ success: boolean; message?: string }>;

  /**
   * Lists the contents (files and directories) of a specified path within the media source.
   * @param {string} path - The path to list.
   * @returns {Promise<MediaSourceEntry[]>} A promise that resolves with an array of MediaSourceEntry objects.
   */
  list(path: string): Promise<MediaSourceEntry[]>;

  /**
   * Retrieves the content of a file from the media source.
   * @param {string} path - The path to the file.
   * @returns {Promise<Buffer>} A promise that resolves with the file content as a Buffer.
   */
  get(path: string): Promise<Buffer>;

  /**
   * Writes content to a file within the media source.
   * @param {string} path - The path to the file.
   * @param {Buffer} content - The content to write to the file.
   * @returns {Promise<void>} A promise that resolves when the content has been written.
   */
  put(path: string, content: Buffer): Promise<void>;

  /**
   * Creates a new directory within the media source.
   * @param {string} path - The path of the directory to create.
   * @returns {Promise<void>} A promise that resolves when the directory has been created.
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Deletes a file or directory from the media source.
   * @param {string} path - The path to the file or directory to delete.
   * @returns {Promise<void>} A promise that resolves when the item has been deleted.
   */
  delete(path: string): Promise<void>;

  /**
   * Renames or moves a file or directory within the media source.
   * @param {string} oldPath - The current path of the item.
   * @param {string} newPath - The new path/name for the item.
   * @returns {Promise<void>} A promise that resolves when the item has been renamed/moved.
   */
  rename(oldPath: string, newPath: string): Promise<void>;
};
