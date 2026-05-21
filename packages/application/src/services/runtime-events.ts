import type {
	AllJobsCompletedEvent,
	JobCompletedEvent,
	JobFailedEvent,
	JobProgressEvent,
	MediaAddedEvent,
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
	WatcherErrorEvent,
} from "@solid-imager/core/domain/sources/events";

export type JobEventPublisher = {
	jobProgress(event: JobProgressEvent): Promise<void> | void;
	jobCompleted(event: JobCompletedEvent): Promise<void> | void;
	jobFailed(event: JobFailedEvent): Promise<void> | void;
	allJobsCompleted?(event: AllJobsCompletedEvent): Promise<void> | void;
};

export type MediaSourceEventPublisher = {
	mediaAdded(event: MediaAddedEvent): Promise<void> | void;
	mediaChanged(event: MediaChangedEvent): Promise<void> | void;
	mediaDeleted(event: MediaDeletedEvent): Promise<void> | void;
	thumbnailGenerated?(event: ThumbnailGeneratedEvent): Promise<void> | void;
	watcherError?(event: WatcherErrorEvent): Promise<void> | void;
	downloadError?(event: {
		mediaSourceId?: string;
		url?: string;
		error: string;
		timestamp?: string;
	}): Promise<void> | void;
};

export function createTimestamp(): string {
	return new Date().toISOString();
}
