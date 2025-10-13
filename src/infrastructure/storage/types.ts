/**
 * Storage Driver Types
 * Extracted from src/lib/drivers/types.ts
 */

// Note: Connection types are now in domain layer
// Import from domain instead of defining here
import type {
  LocalConnectionInfo,
  S3Connection,
  SftpConnection,
} from "~/domain/sources/types";

// すべての接続情報の方をまとめたUnion型
export type ConnectionInfo =
  | LocalConnectionInfo
  | SftpConnection
  | S3Connection;

// ファイルやディレクトリの基本的な情報
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
export type MediaSourceDriver = {
  // 接続テスト
  testConnection(): Promise<{ success: boolean; message?: string }>;

  // 指定されたパスのディレクトリ・ファイル一覧を取得
  list(path: string): Promise<MediaSourceEntry[]>;

  // ファイルの読み込み
  get(path: string): Promise<Buffer>;

  // ファイルのアップロード
  put(path: string, content: Buffer): Promise<void>;

  // ディレクトリの作成
  createDirectory(path: string): Promise<void>;

  // ファイル・ディレクトリの削除
  delete(path: string): Promise<void>;

  // ファイル・ディレクトリのリネーム
  rename(oldPath: string, newPath: string): Promise<void>;
};
