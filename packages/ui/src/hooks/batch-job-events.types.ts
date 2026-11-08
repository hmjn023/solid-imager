import type {
	JobCompletedEvent,
	JobEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/events";

export type ManagerJobHandlers = {
	handleJobProgress: (event: JobProgressEvent) => void;
	handleJobCompleted: (event: JobCompletedEvent) => void;
	handleJobFailed: (event: JobFailedEvent) => void;
	handleJobCancelled?: () => void;
};

export type UseBatchJobEventsOptions = {
	subscribeImmediately?: boolean;
	onEvent?: (event: JobEvent) => void;
	onConnected?: () => void | Promise<void>;
};
