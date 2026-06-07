import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	FindDuplicatesRequest,
	FindDuplicatesResponse,
	Media,
	MediaDetails,
	MediaGenerationInfo,
	MediaMetadataContext,
	MediaSearchResponse,
	MediaTag,
} from "@solid-imager/core/domain/media/schemas";
import type {
	UploadMediaRequest,
	UploadResponse,
} from "@solid-imager/core/domain/media/upload-schemas";

// ============================================================================
// Deferred Action Types (moved from server's job-dispatch-service)
// ============================================================================

export type DeferredJob = {
	mediaId?: string;
	sourcePath?: string;
	type: "processMedia" | "downloadImage";
	payload?: unknown;
};

export type DeferredJobs = {
	mediaSourceId: string;
	jobs: DeferredJob[];
};

export type DeferredSse = {
	mediaSourceId: string;
	event: string;
	payload: unknown;
};

export type FileToDelete = {
	basePath: string;
	filePath: string;
};

export type ThumbnailToDelete = {
	mediaSourceId: string;
	mediaId: string;
};

export type DeferredActions = {
	jobs: DeferredJobs[];
	sse: DeferredSse[];
	filesToDelete?: FileToDelete[];
	thumbnailsToDelete?: ThumbnailToDelete[];
};

// ============================================================================
// Infrastructure Abstractions (server-specific concerns)
// ============================================================================

export interface ISseNotifier {
	sendEvent(mediaSourceId: string, eventType: string, data: unknown): void;
	notifyMediaCopied(
		sourceId: string,
		targetId: string,
		media: Media,
	): void;
}

export interface IThumbnailManager {
	deleteThumbnail(mediaSourceId: string, mediaId: string): Promise<void>;
}

export interface ILogger {
	info(obj: object, msg: string): void;
	error(obj: object, msg: string): void;
	warn(obj: object, msg: string): void;
}

export interface IMediaContextProcessor {
	addContextMetadataToExistingMedia(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void>;
}

export interface IDeferredActionExecutor {
	execute(actions: DeferredActions): Promise<void>;
}

// ============================================================================
// Media Service Interface
// ============================================================================

export interface IMediaService {
	startProcessing(mediaSourceId: string): void;

	searchMedia(
		mediaSourceId: string | undefined | null,
		params: unknown,
	): Promise<MediaSearchResponse>;

	searchMediaInDirectory(
		mediaSourceId: string,
		directoryPath: string,
		params: { query?: string; tags?: string[] },
	): Promise<Media[]>;

	uploadMedia(
		mediaSourceId: string,
		file: File,
		options: UploadMediaRequest,
	): Promise<UploadResponse>;

	getMediaDetails(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaDetails>;

	getMediaContent(
		mediaSourceId: string,
		mediaId: string,
	): Promise<{ buffer: Uint8Array; contentType: string }>;

	registerExistingMedia(
		mediaSourceId: string,
		directoryPath: string,
	): Promise<void>;

	getAllMedia(mediaSourceId: string): Promise<Media[]>;

	getMedia(mediaSourceId: string, mediaId: string): Promise<Media>;

	updateMedia(
		mediaSourceId: string,
		mediaId: string,
		updates: unknown,
		tx?: Transaction,
	): Promise<Media>;

	reprocessMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null>;

	getMediaTags(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaTag[]>;

	getMediaMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null>;

	copyMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{
		success: boolean;
		media: Media;
		deferred?: DeferredActions;
	}>;

	moveMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{
		success: boolean;
		media: Media;
		deferred?: DeferredActions;
	}>;

	deleteMedia(
		mediaSourceId: string,
		mediaId: string,
		tx?: Transaction,
	): Promise<DeferredActions | undefined>;

	findDuplicates(
		request: FindDuplicatesRequest,
	): Promise<FindDuplicatesResponse>;
}
