import type { IFileSystem } from "@solid-imager/core";
import { join, tempDir } from "@tauri-apps/api/path";
import {
	copyFile,
	exists,
	mkdir,
	readDir,
	readFile,
	readTextFile,
	remove,
	rename,
	stat,
	writeFile,
} from "@tauri-apps/plugin-fs";

export class TauriFileSystem implements IFileSystem {
	async exists(path: string): Promise<boolean> {
		return exists(path);
	}

	async readFile(path: string): Promise<Uint8Array> {
		return readFile(path);
	}

	async readTextFile(path: string): Promise<string> {
		return readTextFile(path);
	}

	async writeFile(path: string, data: string | Uint8Array): Promise<void> {
		const bytes =
			typeof data === "string" ? new TextEncoder().encode(data) : data;
		await writeFile(path, bytes);
	}

	async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
		await mkdir(path, { recursive: options?.recursive });
	}

	async readdir(path: string): Promise<string[]> {
		const entries = await readDir(path);
		return entries.map((e) => e.name).filter(Boolean) as string[];
	}

	async stat(path: string): Promise<{
		size: number;
		mtime: Date;
		birthtime: Date;
		isDirectory: boolean;
	}> {
		const s = await stat(path);
		return {
			size: s.size ?? 0,
			mtime: s.mtime ? new Date(s.mtime) : new Date(0),
			birthtime: s.birthtime ? new Date(s.birthtime) : new Date(0),
			isDirectory: s.isDirectory,
		};
	}

	async unlink(path: string): Promise<void> {
		await remove(path);
	}

	async rm(
		path: string,
		options?: { recursive?: boolean; force?: boolean },
	): Promise<void> {
		try {
			await remove(path, { recursive: options?.recursive });
		} catch (e) {
			if (!options?.force) throw e;
		}
	}

	async copyFile(src: string, dest: string): Promise<void> {
		await copyFile(src, dest);
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		await rename(oldPath, newPath);
	}

	async mkdtemp(prefix: string): Promise<string> {
		const tmp = await tempDir();
		const dir = await join(tmp, prefix + Math.random().toString(36).slice(2));
		await mkdir(dir, { recursive: true });
		return dir;
	}
}
