import path from "node:path";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type {
  MediaSourceDriver,
  MediaSourceEntry,
  S3Connection,
} from "./types";

export class S3Driver implements MediaSourceDriver {
  private readonly client: S3Client;
  private readonly connectionInfo: S3Connection;

  constructor(connectionInfo: S3Connection) {
    this.client = new S3Client({
      region: connectionInfo.region,
      credentials: {
        accessKeyId: connectionInfo.accessKeyId,
        secretAccessKey: connectionInfo.secretAccessKey,
      },
    });
    this.connectionInfo = connectionInfo;
  }

  private getAbsolutePath(p: string): string {
    return path.posix.join(this.connectionInfo.prefix ?? "", p);
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      const command = new HeadBucketCommand({
        // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
        Bucket: this.connectionInfo.bucket,
      });
      await this.client.send(command);
      return { success: true, message: "接続に成功しました。" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました。";
      return {
        success: false,
        message: `接続に失敗しました: ${message}`,
      };
    }
  }

  async list(p: string): Promise<MediaSourceEntry[]> {
    const absolutePath = this.getAbsolutePath(p);
    const command = new ListObjectsV2Command({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Prefix: absolutePath,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Delimiter: "/",
    });
    const response = await this.client.send(command);
    const entries: MediaSourceEntry[] = [];

    // Directories
    if (response.CommonPrefixes) {
      for (const prefix of response.CommonPrefixes) {
        entries.push({
          path: prefix.Prefix?.slice(this.getAbsolutePath("").length) ?? "",
          isDirectory: true,
          size: 0,
          lastModified: new Date(0), // S3 doesn't provide this for prefixes
        });
      }
    }

    // Files
    if (response.Contents) {
      for (const content of response.Contents) {
        // ディレクトリ自身は結果に含めない
        if (content.Key === absolutePath) {
          continue;
        }

        entries.push({
          path: content.Key?.slice(this.getAbsolutePath("").length) ?? "",
          isDirectory: false,
          size: content.Size ?? 0,
          lastModified: content.LastModified ?? new Date(0),
        });
      }
    }

    return entries;
  }

  async get(p: string): Promise<Buffer> {
    const absolutePath = this.getAbsolutePath(p);
    const command = new GetObjectCommand({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Key: absolutePath,
    });
    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error("S3からBodyがありません");
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async put(p: string, content: Buffer): Promise<void> {
    const absolutePath = this.getAbsolutePath(p);
    const command = new PutObjectCommand({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Key: absolutePath,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Body: content,
    });
    await this.client.send(command);
  }

  async createDirectory(p: string): Promise<void> {
    // S3ではディレクトリはオブジェクトのキーの一部として扱われるため、
    // 通常は末尾に / を持つ0バイトのオブジェクトを作成する
    const absolutePath = this.getAbsolutePath(p);
    const command = new PutObjectCommand({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Key: `${absolutePath}/`,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Body: "",
    });
    await this.client.send(command);
  }

  async delete(p: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(p);
    // S3ではディレクトリを削除する場合、その中のファイルをすべて削除する必要がある
    const listCommand = new ListObjectsV2Command({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Prefix: absolutePath,
    });
    const listedObjects = await this.client.send(listCommand);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      // ファイル単体の削除
      const deleteCommand = new DeleteObjectCommand({
        // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
        Bucket: this.connectionInfo.bucket,
        // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
        Key: absolutePath,
      });
      await this.client.send(deleteCommand);
      return;
    }
    // ディレクトリ内のオブジェクトをすべて削除
    const deleteKeys = listedObjects.Contents.map((obj) => ({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Key: obj.Key,
    }));
    const deleteCommand = new DeleteObjectsCommand({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Delete: { Objects: deleteKeys },
    });
    await this.client.send(deleteCommand);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    // S3にはリネームの直接的な機能がないため、コピー＆削除で実装
    const absoluteOldPath = this.getAbsolutePath(oldPath);
    const absoluteNewPath = this.getAbsolutePath(newPath);

    // ToDo: ディレクトリのリネームの場合は再帰的に処理する必要がある
    const copySource = `${this.connectionInfo.bucket}/${absoluteOldPath}`;

    const copyCommand = new PutObjectCommand({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      CopySource: copySource,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Key: absoluteNewPath,
    });
    await this.client.send(copyCommand);

    const deleteCommand = new DeleteObjectCommand({
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Bucket: this.connectionInfo.bucket,
      // biome-ignore lint/style/useNamingConvention: AWS S3 SDK uses PascalCase
      Key: absoluteOldPath,
    });
    await this.client.send(deleteCommand);
  }
}
