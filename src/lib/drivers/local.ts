import fs from "node:fs/promises";
import path from "node:path";
import type {
  LocalConnection,
  MediaSourceDriver,
  MediaSourceEntry,
} from "./types";

export class LocalDriver implements MediaSourceDriver {
  private readonly basePath: string;

  constructor(connectionInfo: LocalConnection) {
    this.basePath = connectionInfo.path;
  }

  private getAbsolutePath(p: string): string {
    // パストラバーサル攻撃を防ぐために正規化
    const resolvedPath = path.join(this.basePath, p);
    if (!resolvedPath.startsWith(this.basePath)) {
      throw new Error("Invalid path");
    }
    return resolvedPath;
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await fs.access(this.basePath, fs.constants.R_OK);
      await fs.access(this.basePath, fs.constants.W_OK);
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
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    return Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(p, entry.name);
        const entryAbsolutePath = this.getAbsolutePath(entryPath);
        const stats = await fs.stat(entryAbsolutePath);
        return {
          path: entryPath,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          lastModified: stats.mtime,
        };
      })
    );
  }

  async get(p: string): Promise<Buffer> {
    const absolutePath = this.getAbsolutePath(p);
    return await fs.readFile(absolutePath);
  }

  async put(p: string, content: Buffer): Promise<void> {
    const absolutePath = this.getAbsolutePath(p);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }

  async createDirectory(p: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(p);
    await fs.mkdir(absolutePath, { recursive: true });
  }

  async delete(p: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(p);
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true, force: true });
    } else {
      await fs.rm(absolutePath);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const absoluteOldPath = this.getAbsolutePath(oldPath);
    const absoluteNewPath = this.getAbsolutePath(newPath);
    await fs.rename(absoluteOldPath, absoluteNewPath);
  }
}
