import type { Transaction } from "@solid-imager/core/ports";
import type { Media, MediaMetadataContext } from "@solid-imager/core/media";
import type { Job } from "@solid-imager/core/jobs";

/** Registers media, executes processing jobs and controls automatic processing options. */
export interface IMediaProcessingService {
	registerAndProcess(
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	): Promise<Media>;

	executeProcessMediaJob(job: Job): Promise<void>;

	addContextMetadataToExistingMedia(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void>;

	updateConfig(config: {
		enableAutoTagging: boolean;
		enableAutoCcipExtraction: boolean;
		enableAutoEmbeddingExtraction?: boolean;
	}): void;
}
