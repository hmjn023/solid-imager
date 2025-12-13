import path from "node:path";
import { type WebDAVClient, createClient } from "webdav";
import type { NextcloudConnection } from "~/domain/sources/schemas";
import type { MediaSourceDriver, MediaSourceEntry } from "./types";

/**
 * Implements the MediaSourceDriver interface for Nextcloud (WebDAV) access.
 */
export class NextcloudDriver implements MediaSourceDriver {
  private client: WebDAVClient;

  constructor(connectionInfo: NextcloudConnection) {
    this.client = createClient(connectionInfo.url, {
      username: connectionInfo.username,
      password: connectionInfo.password,
    });
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.client.getDirectoryContents("/");
      return { success: true, message: "Connection successful" };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async list(p: string): Promise<MediaSourceEntry[]> {
    // webdav library paths should usually start with /
    const remotePath = p.startsWith("/") ? p : `/${p}`;
    const contents = await this.client.getDirectoryContents(remotePath);

    if (!Array.isArray(contents)) {
      // It might be a single file info if path points to a file,
      // but for list() we expect a directory.
      // If it's a file, we wrap it in array or return empty if semantics require directory listing.
      // Assuming getDirectoryContents returns array for directory.
      return [];
    }

    return contents.map((item) => ({
      path: item.filename, // item.filename is usually the full path
      isDirectory: item.type === "directory",
      size: item.size,
      lastModified: new Date(item.lastmod),
    }));
  }

  async get(p: string): Promise<Buffer> {
    const remotePath = p.startsWith("/") ? p : `/${p}`;
    const content = await this.client.getFileContents(remotePath);
    if (Buffer.isBuffer(content)) {
      return content;
    }
    if (typeof content === "string") {
      return Buffer.from(content);
    }
    throw new Error("Received unexpected content type from WebDAV");
  }

  async put(p: string, content: Buffer): Promise<void> {
    const remotePath = p.startsWith("/") ? p : `/${p}`;
    // Ensure directory exists? webdav might need recursive creation or explicit creation.
    // For now, simple put.
    await this.client.putFileContents(remotePath, content);
  }

  async createDirectory(p: string): Promise<void> {
    const remotePath = p.startsWith("/") ? p : `/${p}`;
    await this.client.createDirectory(remotePath);
  }

  async delete(p: string): Promise<void> {
    const remotePath = p.startsWith("/") ? p : `/${p}`;
    await this.client.deleteFile(remotePath);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const remoteOldPath = oldPath.startsWith("/") ? oldPath : `/${oldPath}`;
    const remoteNewPath = newPath.startsWith("/") ? newPath : `/${newPath}`;
    await this.client.moveFile(remoteOldPath, remoteNewPath);
  }
}
