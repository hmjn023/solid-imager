import type { z } from "zod";
import type { conflictSchema } from "../media/upload-schemas";

/** File storage operations used by application services. */
export type IStorageService = {
	saveFile(
		basePath: string,
		file: File,
		options: {
			filename?: string;
			overwrite?: boolean;
			autoIncrement?: boolean;
		},
	): Promise<{
		filePath: string;
		fileName: string;
		width: number;
		height: number;
		size: number;
		createdAt: Date;
		modifiedAt: Date;
		conflict?: z.infer<typeof conflictSchema>;
	}>;

	deleteFile(basePath: string, filePath: string): Promise<void>;

	getFile(basePath: string, filePath: string): Promise<Buffer>;

	scanDirectory(basePath: string): Promise<string[]>;

	getFileMetadata(fullPath: string): Promise<{
		width: number;
		height: number;
		size: number;
		createdAt: Date;
		modifiedAt: Date;
	}>;

	copyFile(
		sourcePath: string,
		targetBasePath: string,
		options: {
			filename?: string;
			overwrite?: boolean;
			autoIncrement?: boolean;
		},
	): Promise<{
		filePath: string;
		fileName: string;
		width: number;
		height: number;
		size: number;
		createdAt: Date;
		modifiedAt: Date;
		conflict?: z.infer<typeof conflictSchema>;
	}>;
};
