import type { ProcessMediaJob } from "@solid-imager/application/services/media-processing-job";
import type { Job } from "../db/schema";

export type {
	MediaProcessingStep,
	ProcessMediaJob,
} from "@solid-imager/application/services/media-processing-job";
export { MEDIA_PROCESSING_STEPS } from "@solid-imager/application/services/media-processing-job";

export type PersistedProcessMediaJob = ProcessMediaJob & {
	id: string;
	status: Job["status"];
	error: string | null;
	createdAt: Date;
	updatedAt: Date;
};
