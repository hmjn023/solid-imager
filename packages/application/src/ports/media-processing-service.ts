import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import type {
	MediaTaskKind,
	ProcessingOwner,
} from "@solid-imager/core/domain/processing/schemas";

export interface IMediaProcessingService {
	registerAndProcess(
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	): Promise<Media>;

	executeProcessMediaJob(job: Job): Promise<void>;
	processTask(
		sourceId: string,
		mediaId: string,
		kind: Exclude<MediaTaskKind, "tagging">,
		owner?: ProcessingOwner,
		force?: boolean,
	): Promise<void>;

	addContextMetadataToExistingMedia(
		mediaId: string,
		context: Partial<MediaMetadataContext>,
		tx?: Transaction,
	): Promise<void>;

	updateConfig(config: {
		enableAutoTagging: boolean;
		enableAutoCcipExtraction: boolean;
	}): void;
}
