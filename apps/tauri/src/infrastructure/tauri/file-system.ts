import type { IFileSystem } from "@solid-imager/core/interfaces/file-system";
import type { TauriCommandClient } from "./command-client";

type TauriFileStat = {
	size: number;
	mtime: string;
	birthtime: string;
	isDirectory: boolean;
};

function toUint8Array(data: Uint8Array | number[]): Uint8Array {
	return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export class TauriFileSystem implements IFileSystem {
	constructor(private readonly commandClient: TauriCommandClient) {}

	async exists(path: string) {
		return this.commandClient.invoke<boolean>("fs_exists", { path });
	}

	async readFile(path: string) {
		const data = await this.commandClient.invoke<Uint8Array | number[]>("fs_read_file", { path });

		return toUint8Array(data);
	}

	async readTextFile(path: string, encoding: "utf-8" = "utf-8") {
		return this.commandClient.invoke<string>("fs_read_text_file", {
			path,
			encoding,
		});
	}

	async writeFile(path: string, data: string | Uint8Array) {
		await this.commandClient.invoke("fs_write_file", {
			path,
			data: data instanceof Uint8Array ? Array.from(data) : data,
		});
	}

	async mkdir(path: string, options?: { recursive?: boolean }) {
		await this.commandClient.invoke("fs_mkdir", { path, options });
	}

	async readdir(path: string) {
		return this.commandClient.invoke<string[]>("fs_readdir", { path });
	}

	async stat(path: string) {
		const stat = await this.commandClient.invoke<TauriFileStat>("fs_stat", {
			path,
		});

		return {
			size: stat.size,
			mtime: new Date(stat.mtime),
			birthtime: new Date(stat.birthtime),
			isDirectory: stat.isDirectory,
		};
	}

	async unlink(path: string) {
		await this.commandClient.invoke("fs_unlink", { path });
	}

	async rm(path: string, options?: { recursive?: boolean; force?: boolean }) {
		await this.commandClient.invoke("fs_rm", { path, options });
	}

	async copyFile(src: string, dest: string) {
		await this.commandClient.invoke("fs_copy_file", { src, dest });
	}

	async rename(oldPath: string, newPath: string) {
		await this.commandClient.invoke("fs_rename", { oldPath, newPath });
	}

	async mkdtemp(prefix: string) {
		return this.commandClient.invoke<string>("fs_mkdtemp", { prefix });
	}
}
