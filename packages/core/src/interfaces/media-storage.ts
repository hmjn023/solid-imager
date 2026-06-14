import type { z } from "zod";
import type { conflictSchema } from "@/domain/media/upload-schemas";

export type MediaStorageResult = {
	filePath: string;
	fileName: string;
	width: number;
	height: number;
	size: number;
	createdAt: Date;
	modifiedAt: Date;
	conflict?: z.infer<typeof conflictSchema>;
};

export type MediaSourceFile = {
	name: string;
	arrayBuffer(): Promise<ArrayBuffer | Uint8Array>;
};

export type MediaMetadata = {
	width: number;
	height: number;
	size: number;
	createdAt: Date;
	modifiedAt: Date;
};

export type IMediaStorage = {
	saveFile(
		basePath: string,
		file: MediaSourceFile,
		options: {
			filename?: string;
			overwrite?: boolean;
			autoIncrement?: boolean;
		},
	): Promise<MediaStorageResult>;

	deleteFile(basePath: string, filePath: string): Promise<void>;

	getFile(basePath: string, filePath: string): Promise<Uint8Array>;

	scanDirectory(basePath: string): Promise<string[]>;

	getFileMetadata(fullPath: string): Promise<MediaMetadata>;

	copyFile(
		sourcePath: string,
		targetBasePath: string,
		options: {
			filename?: string;
			overwrite?: boolean;
			autoIncrement?: boolean;
		},
	): Promise<MediaStorageResult>;

	moveFile(
		basePath: string,
		sourcePath: string,
		targetPath: string,
	): Promise<void>;
};
