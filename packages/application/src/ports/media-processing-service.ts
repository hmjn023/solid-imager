import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import type {
	FileTaskKind,
	MediaProcessingState,
	ProcessingOwner,
} from "@solid-imager/core/domain/processing/schemas";

export interface IMediaProcessingService {
	requestProcessing(
		media: Media,
		sourcePath: string,
		options: {
			skipMetadataExtraction?: boolean;
			skipThumbnailGeneration?: boolean;
			skipAi?: boolean;
		},
		tx: Transaction,
	): Promise<void>;
	requestTask(
		sourceId: string,
		mediaId: string,
		kind: FileTaskKind,
		force?: boolean,
		tx?: Transaction,
		repair?: boolean,
	): Promise<MediaProcessingState | null>;
	waitForTask(
		mediaId: string,
		kind: FileTaskKind,
		request: Pick<MediaProcessingState, "requestId" | "requestedRevision">,
		owner?: ProcessingOwner,
	): Promise<void>;
	runFileTask(
		kind: FileTaskKind,
	): Promise<"idle" | "completed" | "retry" | "failed" | "superseded">;
	reconcileFileTasks(): Promise<void>;

	registerAndProcess(
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
	): Promise<Media>;

	executeProcessMediaJob(job: Job): Promise<void>;
	processTask(
		sourceId: string,
		mediaId: string,
		kind: FileTaskKind,
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
