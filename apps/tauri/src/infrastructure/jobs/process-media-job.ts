import type { Job } from "../db/schema";

export const MEDIA_PROCESSING_STEPS = [
	"extractMetadata",
	"generateThumbnail",
	"queueAutoTagging",
] as const;

export type MediaProcessingStep = (typeof MEDIA_PROCESSING_STEPS)[number];

export type ProcessMediaJob = {
	sourceId: string;
	mediaId: string;
	sourcePath: string;
	steps?: MediaProcessingStep[];
};

export type PersistedProcessMediaJob = ProcessMediaJob & {
	id: string;
	status: Job["status"];
	error: string | null;
	createdAt: Date;
	updatedAt: Date;
};
