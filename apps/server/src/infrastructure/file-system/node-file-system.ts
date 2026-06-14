import fs from "node:fs/promises";
import type { IFileSystem } from "@solid-imager/core";

export class NodeFileSystem implements IFileSystem {
	async exists(path: string): Promise<boolean> {
		return await Bun.file(path).exists();
	}

	async readFile(path: string): Promise<Uint8Array> {
		return await Bun.file(path).bytes();
	}

	async readTextFile(path: string, _encoding = "utf-8"): Promise<string> {
		return await Bun.file(path).text();
	}

	async writeFile(path: string, data: string | Uint8Array): Promise<void> {
		await Bun.write(path, data);
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
		await Bun.file(path).delete();
	}

	async rm(
		path: string,
		options?: { recursive?: boolean; force?: boolean },
	): Promise<void> {
		await fs.rm(path, options);
	}

	async copyFile(src: string, dest: string): Promise<void> {
		await Bun.write(dest, Bun.file(src));
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		await fs.rename(oldPath, newPath);
	}

	async mkdtemp(prefix: string): Promise<string> {
		return await fs.mkdtemp(prefix);
	}
}
