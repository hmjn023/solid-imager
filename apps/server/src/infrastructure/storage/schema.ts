import type {
  LocalConnection,
  S3Connection,
  SftpConnection,
} from "@solid-imager/core/domain/sources/schemas";
import { z } from "zod";

// すべての接続情報の方をまとめたUnion型
export type ConnectionInfo = LocalConnection | SftpConnection | S3Connection;

// ファイルやディレクトリの基本的な情報
export const mediaSourceEntrySchema = z.object({
  // フルパス
  path: z.string(),
  // ディレクトリかどうか
  isDirectory: z.boolean(),
  // ファイルサイズ
  size: z.number(),
  // 更新日時
  lastModified: z.date(),
});

/**
 * Represents basic information about a file or directory within a media source.
 */
export type MediaSourceEntry = z.infer<typeof mediaSourceEntrySchema>;

// ドライバのインターフェース定義 (メソッドを持つため TypeScript の type のまま残す)
/**
 * Defines the interface for media source drivers.
 */
export type MediaSourceDriver = {
  /**
   * Tests the connection to the media source.
   */
  testConnection(): Promise<{ success: boolean; message?: string }>;

  /**
   * Lists the contents (files and directories) of a specified path within the media source.
   */
  list(path: string): Promise<MediaSourceEntry[]>;

  /**
   * Retrieves the content of a file from the media source.
   */
  get(path: string): Promise<Buffer>;

  /**
   * Writes content to a file within the media source.
   */
  put(path: string, content: Buffer): Promise<void>;

  /**
   * Creates a new directory within the media source.
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Deletes a file or directory from the media source.
   */
  delete(path: string): Promise<void>;

  /**
   * Renames or moves a file or directory within the media source.
   */
  rename(oldPath: string, newPath: string): Promise<void>;
};
