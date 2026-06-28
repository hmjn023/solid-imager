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

export type SyncOptions = {
	pruneMissing?: boolean;
	optimize?: boolean;
	activeIds?: string[];
	resolveActiveIds?: (
		candidateIds: string[],
	) => Promise<ReadonlySet<string> | string[]>;
	existingIdPageSize?: number;
	deleteChunkSize?: number;
};

export type SyncPagesOptions = SyncOptions;

export type SyncDeltaOptions = {
	mediaIdsToDelete?: string[];
	itemsToUpsert?: MediaDumpItem[];
	optimize?: boolean;
};

export interface ILanceDbDumpService {
	writeToLanceDB(
		items: MediaDumpItem[],
		options: WriteOptions,
	): Promise<string>;
	syncLanceDB(
		lanceDbDir: string,
		itemsToUpsert: MediaDumpItem[],
		options?: SyncOptions,
	): Promise<void>;
	syncLanceDBPages(
		lanceDbDir: string,
		itemPages: AsyncIterable<MediaDumpItem[]>,
		options?: SyncPagesOptions,
	): Promise<number>;
	syncLanceDBDelta(
		lanceDbDir: string,
		options: SyncDeltaOptions,
	): Promise<{ deleted: number; upserted: number }>;
	readFromLanceDB(
		lanceDbDir: string,
		options?: ReadOptions,
	): Promise<MediaDumpItemWithImageData[]>;
	readMediaIds(lanceDbDir: string): Promise<string[]>;
	readMediaIdPages(
		lanceDbDir: string,
		pageSize?: number,
	): AsyncIterable<string[]>;
	findExistingMediaIds(
		lanceDbDir: string,
		mediaIds: string[],
	): Promise<string[]>;
	cleanupLanceDBDir(dir: string): Promise<void>;
}
