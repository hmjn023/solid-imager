import type { Transaction } from "@solid-imager/core/ports";
import type {
	FindDuplicatesRequest,
	FindDuplicatesResponse,
	Media,
	MediaDetails,
	MediaGenerationInfo,
	MediaMetadataContext,
	MediaSearchRequestInput,
	MediaSearchResponse,
	MediaTag,
	UpdateMediaRequestInput,
	UploadMediaRequest,
	UploadResponse,
} from "@solid-imager/core/media";
import type {
	SourceEventCommand,
	SourceEventData,
	SourceEventName,
} from "@solid-imager/core/events";

// ============================================================================
// Deferred Action Types (moved from server's job-dispatch-service)
// ============================================================================

/** A processing or download job to dispatch as part of deferred media actions. */
export type DeferredJob = {
	mediaId?: string;
	sourcePath?: string;
	type: "processMedia" | "downloadImage";
	payload?: unknown;
};

/** Jobs grouped by the media source they belong to. */
export type DeferredJobs = {
	mediaSourceId: string;
	jobs: DeferredJob[];
};

/** A source event together with the source to which it will be published. */
export type DeferredSourceEvent = {
	mediaSourceId: string;
} & SourceEventCommand;

/** A file deletion request identifying the source base and file path. */
export type FileToDelete = {
	basePath: string;
	filePath: string;
};

/** A thumbnail deletion request scoped to a media source. */
export type ThumbnailToDelete = {
	mediaSourceId: string;
	mediaId: string;
};

/** Side effects collected by a media operation for execution after its transaction. */
export type DeferredActions = {
	jobs: DeferredJobs[];
	sourceEvents: DeferredSourceEvent[];
	filesToDelete?: FileToDelete[];
	thumbnailsToDelete?: ThumbnailToDelete[];
};

// ============================================================================
// Infrastructure Abstractions (server-specific concerns)
// ============================================================================

/** Publishes source events and copy notifications to interested consumers. */
export interface ISourceEventPublisher {
	publishSource<TName extends SourceEventName>(
		mediaSourceId: string,
		eventType: TName,
		data: SourceEventData<TName>,
	): void;
	notifyMediaCopied(sourceId: string, targetId: string, media: Media): void;
}

/** Removes thumbnails associated with media. */
export interface IThumbnailManager {
	deleteThumbnail(mediaSourceId: string, mediaId: string): Promise<void>;
}

/** Adds contextual metadata to existing media, optionally within a transaction. */
export interface IMediaContextProcessor {
	addContextMetadataToExistingMedia(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void>;
}

/** Executes the jobs, events and cleanup collected by a media operation. */
export interface IDeferredActionExecutor {
	execute(actions: DeferredActions): Promise<void>;
}

// ============================================================================
// Media Service Interface
// ============================================================================

/** Application operations for searching, uploading and managing media. */
export interface IMediaService {
	startProcessing(mediaSourceId: string): void;

	searchMedia(
		mediaSourceId: string | undefined | null,
		params: MediaSearchRequestInput,
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
		updates: UpdateMediaRequestInput,
		tx?: Transaction,
	): Promise<Media>;

	reprocessMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null>;

	getMediaTags(mediaSourceId: string, mediaId: string): Promise<MediaTag[]>;

	getMediaMetadata(
		mediaSourceId: string,
		mediaId: string,
	): Promise<MediaGenerationInfo | null>;

	/**
	 * Copy media between local sources, including its metadata.
	 * @param sourceMediaId - Media to copy.
	 * @param targetSourceId - Destination source; both sources must be local.
	 * @param tx - Existing transaction. When supplied, the caller must execute deferred actions after commit.
	 * @returns The new media and, when a transaction is supplied, jobs and events to execute after commit.
	 * @throws If the media or either source is missing, the sources are not local, or the copy fails.
	 */
	copyMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{
		success: boolean;
		media: Media;
		deferred?: DeferredActions;
	}>;

	/**
	 * Copy media to another local source and remove the original.
	 * @param sourceMediaId - Media to move.
	 * @param targetSourceId - Destination source; both sources must be local.
	 * @param tx - Existing transaction. When supplied, the caller must execute deferred actions after commit.
	 * @returns The new media and deferred actions. Without a supplied transaction the service has already executed those actions.
	 * @throws If copying or deleting the media fails.
	 */
	moveMedia(
		sourceMediaId: string,
		targetSourceId: string,
		tx?: Transaction,
	): Promise<{
		success: boolean;
		media: Media;
		deferred?: DeferredActions;
	}>;

	/**
	 * Delete a media record and schedule or perform its file, thumbnail and event side effects.
	 * @param mediaSourceId - Source expected to own the media.
	 * @param mediaId - Media to delete.
	 * @param tx - Existing transaction. When supplied, the caller must execute the returned actions after commit.
	 * @returns Deferred cleanup and event actions when a transaction is supplied; otherwise undefined.
	 * @throws If the media is missing or belongs to another source.
	 */
	deleteMedia(
		mediaSourceId: string,
		mediaId: string,
		tx?: Transaction,
	): Promise<DeferredActions | undefined>;

	findDuplicates(
		request: FindDuplicatesRequest,
	): Promise<FindDuplicatesResponse>;
}
