import fs from "node:fs/promises";
import type { IFileSystem } from "@solid-imager/core";

export class NodeFileSystem implements IFileSystem {
	async exists(path: string): Promise<boolean> {
		try {
			await fs.access(path);
			return true;
		} catch {
			return false;
		}
	}

	async readFile(path: string): Promise<Uint8Array> {
		return await fs.readFile(path);
	}

	async readTextFile(path: string, encoding = "utf-8"): Promise<string> {
		return await fs.readFile(path, { encoding: encoding as BufferEncoding });
	}

	async writeFile(path: string, data: string | Uint8Array): Promise<void> {
		await fs.writeFile(path, data);
	}

	async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
		await fs.mkdir(path, options);
	}

	async readdir(path: string): Promise<string[]> {
		return await fs.readdir(path);
	}

	async stat(path: string) {
		const stats = await fs.stat(path);
		return {
			size: stats.size,
			mtime: stats.mtime,
			birthtime: stats.birthtime,
			isDirectory: stats.isDirectory(),
		};
	}

	async unlink(path: string): Promise<void> {
		await fs.unlink(path);
	}

	async rm(
		path: string,
		options?: { recursive?: boolean; force?: boolean },
	): Promise<void> {
		await fs.rm(path, options);
	}

	async copyFile(src: string, dest: string): Promise<void> {
		await fs.copyFile(src, dest);
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		await fs.rename(oldPath, newPath);
	}

	async mkdtemp(prefix: string): Promise<string> {
		return await fs.mkdtemp(prefix);
	}
}
