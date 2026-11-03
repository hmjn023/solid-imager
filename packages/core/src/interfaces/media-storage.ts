import type { z } from "zod";
import type { conflictSchema } from "@/domain/media/upload-schemas";

/** Stored file metadata and an optional name conflict. */
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

/** Minimal file input supported by media storage implementations. */
export type MediaSourceFile = {
	name: string;
	arrayBuffer(): Promise<ArrayBuffer | Uint8Array>;
};

/** Dimensions, size and timestamps read from a stored file. */
export type MediaMetadata = {
	width: number;
	height: number;
	size: number;
	createdAt: Date;
	modifiedAt: Date;
};

/** Platform-neutral port for reading and modifying media files. */
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
