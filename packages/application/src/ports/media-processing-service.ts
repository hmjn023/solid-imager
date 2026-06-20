import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";

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

	updateConfig(config: { enableAutoTagging: boolean }): void;
}
