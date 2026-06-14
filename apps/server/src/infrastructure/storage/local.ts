/**
 * Local Storage Driver
 * Extracted from src/lib/drivers/local.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { LocalConnection } from "@solid-imager/core/domain/sources/schemas";
import type { MediaSourceDriver, MediaSourceEntry } from "./schema";

/**
 * Implements the MediaSourceDriver interface for local file system access.
 * Manages media files stored in a local directory.
 */
export class LocalDriver implements MediaSourceDriver {
	private readonly basePath: string;

	/**
	 * Creates an instance of LocalDriver.
	 * @param {LocalConnection} connectionInfo - The connection information for the local media source.
	 */
	constructor(connectionInfo: LocalConnection) {
		this.basePath = connectionInfo.path;
	}

	/**
	 * Resolves a relative path to an absolute path within the base directory,
	 * preventing path traversal attacks.
	 * @param {string} p - The relative path.
	 * @returns {string} The resolved absolute path.
	 * @throws {Error} If the resolved path attempts to access outside the base directory.
	 */
	private getAbsolutePath(p: string): string {
		// パストラバーサル攻撃を防ぐために正規化
		const resolvedPath = path.join(this.basePath, p);
		if (!resolvedPath.startsWith(this.basePath)) {
			throw new Error("Invalid path");
		}
		return resolvedPath;
	}

	/**
	 * Tests the connection to the local media source by checking read and write access to the base path.
	 * @returns {Promise<{ success: boolean; message?: string }>} A promise that resolves with the connection test result.
	 */
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

	/**
	 * Lists the contents (files and directories) of a specified path within the local media source.
	 * @param {string} p - The path to list.
	 * @returns {Promise<MediaSourceEntry[]>} A promise that resolves with an array of MediaSourceEntry objects.
	 */
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
			}),
		);
	}

	/**
	 * Retrieves the content of a file from the local media source.
	 * @param {string} p - The path to the file.
	 * @returns {Promise<Buffer>} A promise that resolves with the file content as a Buffer.
	 */
	async get(p: string): Promise<Buffer> {
		const absolutePath = this.getAbsolutePath(p);
		const bytes = await Bun.file(absolutePath).bytes();
		return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	}

	/**
	 * Writes content to a file within the local media source.
	 * Creates parent directories if they don't exist.
	 * @param {string} p - The path to the file.
	 * @param {Buffer} content - The content to write to the file.
	 * @returns {Promise<void>} A promise that resolves when the content has been written.
	 */
	async put(p: string, content: Buffer): Promise<void> {
		const absolutePath = this.getAbsolutePath(p);
		await fs.mkdir(path.dirname(absolutePath), { recursive: true });
		await Bun.write(absolutePath, content);
	}

	/**
	 * Creates a new directory within the local media source.
	 * Creates parent directories if they don't exist.
	 * @param {string} p - The path of the directory to create.
	 * @returns {Promise<void>} A promise that resolves when the directory has been created.
	 */
	async createDirectory(p: string): Promise<void> {
		const absolutePath = this.getAbsolutePath(p);
		await fs.mkdir(absolutePath, { recursive: true });
	}

	/**
	 * Deletes a file or directory from the local media source.
	 * If it's a directory, it will be deleted recursively.
	 * @param {string} p - The path to the file or directory to delete.
	 * @returns {Promise<void>} A promise that resolves when the item has been deleted.
	 */
	async delete(p: string): Promise<void> {
		const absolutePath = this.getAbsolutePath(p);
		const stats = await fs.stat(absolutePath);
		if (stats.isDirectory()) {
			await fs.rm(absolutePath, { recursive: true, force: true });
		} else {
			await fs.rm(absolutePath);
		}
	}

	/**
	 * Renames or moves a file or directory within the local media source.
	 * @param {string} oldPath - The current path of the item.
	 * @param {string} newPath - The new path/name for the item.
	 * @returns {Promise<void>} A promise that resolves when the item has been renamed/moved.
	 */
	async rename(oldPath: string, newPath: string): Promise<void> {
		const absoluteOldPath = this.getAbsolutePath(oldPath);
		const absoluteNewPath = this.getAbsolutePath(newPath);
		await fs.rename(absoluteOldPath, absoluteNewPath);
	}
}
