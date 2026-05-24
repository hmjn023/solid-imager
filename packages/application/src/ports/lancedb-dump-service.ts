import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";

export type MediaDumpItemWithImageData = MediaDumpItem & {
	_imageData?: Uint8Array;
};

export type WriteOptions = {
	includeImages: boolean;
	getImageBuffer?: (filePath: string) => Promise<Buffer | null>;
	tempDir?: string;
};

export type ReadOptions = {
	extractImages?: boolean;
	saveImageBuffer?: (filePath: string, buffer: Buffer) => Promise<void>;
	onChunk?: (chunk: MediaDumpItemWithImageData[]) => Promise<void>;
};

export interface ILanceDbDumpService {
	writeToLanceDB(
		items: MediaDumpItem[],
		options: WriteOptions,
	): Promise<string>;
	readFromLanceDB(
		lanceDbDir: string,
		options?: ReadOptions,
	): Promise<MediaDumpItemWithImageData[]>;
	cleanupLanceDBDir(dir: string): Promise<void>;
}
