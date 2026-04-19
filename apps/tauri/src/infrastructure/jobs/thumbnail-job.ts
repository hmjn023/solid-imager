import type { Job } from "../db/schema";

export type ThumbnailJob = {
	sourceId: string;
	mediaId: string;
	filePath: string;
	fullPath: string;
};

export type PersistedThumbnailJob = ThumbnailJob & {
	id: string;
	status: Job["status"];
	error: string | null;
	createdAt: Date;
	updatedAt: Date;
};
