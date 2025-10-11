import type { z } from "zod";
import type {
  localConnectionSchema,
  s3ConnectionSchema,
  sftpConnectionSchema,
} from "~/domain/media/schemas";

// Zodスキーマから型を推論
export type S3Connection = z.infer<typeof s3ConnectionSchema>;
export type SftpConnection = z.infer<typeof sftpConnectionSchema>;
export type LocalConnection = z.infer<typeof localConnectionSchema>;

// すべての接続情報の方をまとめたUnion型
export type ConnectionInfo = LocalConnection | SftpConnection | S3Connection;

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
