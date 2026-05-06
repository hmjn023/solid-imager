import type {
	BulkDownloadResponse,
	DownloadItem,
	MediaDetails,
	MediaSearchRequest,
	MediaSearchResponse,
	UpdateMediaRequest,
	UploadMediaRequest,
	UploadResponse,
} from "../domain/media/schemas";
import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "../domain/sources/schemas";

export type {
	UpdateMediaRequest,
	UploadMediaRequest,
	UploadResponse,
} from "../domain/media/schemas";

export type MutationSuccess = {
	success: boolean;
};

export type SourceSyncResult = {
	id: string;
	success: boolean;
	added?: number;
	updated?: number;
	deleted?: number;
	error?: string;
};

export type SyncSourcesResponse = {
	results: SourceSyncResult[];
};

export type MediaSyncResult = {
	id: string;
	success: boolean;
	error?: string;
};

export type SyncMediaItemsResponse = {
	results: MediaSyncResult[];
};

export type BinaryFilePayload = {
	fileName: string;
	mimeType: string;
	data: number[];
};

export type BatchTaggingStartResponse = {
	success: boolean;
	message: string;
	jobId: string;
};

export type MediaApiContract = {
	searchMedia: (
		sourceId: string | undefined | null,
		params: MediaSearchRequest,
	) => Promise<MediaSearchResponse>;
	fetchMediaDetails: (
		sourceId: string,
		mediaId: string,
	) => Promise<MediaDetails>;
	uploadMedia: (
		sourceId: string,
		file: File,
		options?: UploadMediaRequest,
	) => Promise<UploadResponse>;
	updateMedia: (
		sourceId: string,
		mediaId: string,
		updates: UpdateMediaRequest,
	) => Promise<MediaDetails>;
	deleteMedia: (sourceId: string, mediaId: string) => Promise<MutationSuccess>;
	copyMedia: (
		sourceId: string,
		mediaId: string,
		targetSourceId: string,
	) => Promise<MutationSuccess>;
	moveMedia: (
		sourceId: string,
		mediaId: string,
		targetSourceId: string,
	) => Promise<MutationSuccess>;
	syncMediaItems: (
		sourceId: string,
		mediaIds: string[],
	) => Promise<SyncMediaItemsResponse>;
	startDownloadJobs: (
		mediaSourceId: string,
		items: DownloadItem[],
	) => Promise<BulkDownloadResponse>;
};

export type SourcesApiContract = {
	fetchMediaSources: () => Promise<SafeMediaSource[]>;
	fetchMediaSource: (id: string) => Promise<SafeMediaSource>;
	createMediaSource: (data: MediaSourceInfo) => Promise<SafeMediaSource>;
	updateMediaSource: (
		id: string,
		data: Partial<MediaSourceInfo>,
	) => Promise<SafeMediaSource>;
	deleteMediaSource: (id: string) => Promise<MutationSuccess>;
	syncMediaSources: (ids: string[]) => Promise<SyncSourcesResponse>;
	fetchSourceDump: (id: string, mode?: "json" | "zip") => Promise<Blob>;
	restoreSource: (
		id: string,
		data: unknown,
		opts?: {
			signal?: AbortSignal;
			onProgress?: (done: number, total: number) => void;
		},
	) => Promise<{
		processed: number;
		skipped: number;
		errors: string[];
		cancelled?: boolean;
	}>;
	importSourceZip: (
		id: string,
		file: File,
	) => Promise<{
		success: boolean;
		importedCount: number;
		skippedCount: number;
		errors: string[];
		message: string;
	}>;
	parseRestoreFile?: (file: File) => Promise<unknown>;
};

export function createMediaApi(contract: MediaApiContract) {
	return {
		async fetchMediaList(sourceId: string) {
			const result = await contract.searchMedia(sourceId, {
				offset: 0,
				limit: 100,
				sort: "date",
				order: "desc",
			});
			return result.media;
		},
		fetchMediaListInfinite(sourceId: string, pageParam = 0, limit = 50) {
			return contract.searchMedia(sourceId, {
				offset: pageParam,
				limit,
				sort: "date",
				order: "desc",
			});
		},
		fetchMediaDetails(sourceId: string, mediaId: string) {
			return contract.fetchMediaDetails(sourceId, mediaId);
		},
		uploadMedia(sourceId: string, file: File, options?: UploadMediaRequest) {
			return contract.uploadMedia(sourceId, file, options);
		},
		updateMedia(
			sourceId: string,
			mediaId: string,
			updates: UpdateMediaRequest,
		) {
			return contract.updateMedia(sourceId, mediaId, updates);
		},
		deleteMedia(sourceId: string, mediaId: string) {
			return contract.deleteMedia(sourceId, mediaId);
		},
		copyMedia(sourceId: string, mediaId: string, targetSourceId: string) {
			return contract.copyMedia(sourceId, mediaId, targetSourceId);
		},
		moveMedia(sourceId: string, mediaId: string, targetSourceId: string) {
			return contract.moveMedia(sourceId, mediaId, targetSourceId);
		},
		syncMediaItems(sourceId: string, mediaIds: string[]) {
			return contract.syncMediaItems(sourceId, mediaIds);
		},
		startDownloadJobs(mediaSourceId: string, items: DownloadItem[]) {
			return contract.startDownloadJobs(mediaSourceId, items);
		},
	};
}

export function createSourcesApi(contract: SourcesApiContract) {
	return {
		fetchMediaSources() {
			return contract.fetchMediaSources();
		},
		fetchMediaSource(id: string) {
			return contract.fetchMediaSource(id);
		},
		createMediaSource(data: MediaSourceInfo) {
			return contract.createMediaSource(data);
		},
		updateMediaSource(id: string, data: Partial<MediaSourceInfo>) {
			return contract.updateMediaSource(id, data);
		},
		async deleteMediaSource(id: string) {
			await contract.deleteMediaSource(id);
		},
		syncMediaSources(ids: string[]) {
			return contract.syncMediaSources(ids);
		},
		fetchSourceDump(id: string, mode: "json" | "zip" = "json") {
			return contract.fetchSourceDump(id, mode);
		},
		restoreSource(
			id: string,
			data: unknown,
			opts?: {
				signal?: AbortSignal;
				onProgress?: (done: number, total: number) => void;
			},
		) {
			return contract.restoreSource(id, data, opts);
		},
		importSourceZip(id: string, file: File) {
			return contract.importSourceZip(id, file);
		},
		parseRestoreFile(file: File) {
			return contract.parseRestoreFile?.(file);
		},
	};
}
