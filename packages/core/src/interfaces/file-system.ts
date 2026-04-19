export type IFileSystem = {
	exists(path: string): Promise<boolean>;
	readFile(path: string): Promise<Uint8Array>;
	readTextFile(path: string, encoding?: "utf-8"): Promise<string>;
	writeFile(path: string, data: string | Uint8Array): Promise<void>;
	mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
	readdir(path: string): Promise<string[]>;
	stat(path: string): Promise<{
		size: number;
		mtime: Date;
		birthtime: Date;
		isDirectory: boolean;
	}>;
	unlink(path: string): Promise<void>;
	rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
	copyFile(src: string, dest: string): Promise<void>;
	rename(oldPath: string, newPath: string): Promise<void>;
	mkdtemp(prefix: string): Promise<string>;
};
