import type {
	JobCompletedEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/domain/sources/events";

export type ManagerJobHandlers = {
	handleJobProgress: (event: JobProgressEvent) => void;
	handleJobCompleted: (event: JobCompletedEvent) => void;
	handleJobFailed: (event: JobFailedEvent) => void;
	handleJobCancelled?: () => void;
};

export type UseBatchJobEventsOptions = {
	subscribeImmediately?: boolean;
	onConnected?: () => void | Promise<void>;
};
