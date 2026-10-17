import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Media,
	MediaMetadataContext,
} from "@solid-imager/core/domain/media/schemas";
import type {
	FileTaskKind,
	MediaProcessingState,
} from "@solid-imager/core/domain/processing/schemas";

export type MediaRegistrationOptions = {
	tx: Transaction;
	sourcePath?: string;
};

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
		batchId?: string,
	): Promise<MediaProcessingState | null>;
	waitForTask(
		mediaId: string,
		kind: FileTaskKind,
		request: Pick<MediaProcessingState, "requestId" | "requestedRevision">,
	): Promise<void>;
	runFileTask(
		kind: FileTaskKind,
	): Promise<"idle" | "completed" | "retry" | "failed" | "superseded">;
	reconcileFileTasks(): Promise<void>;

	registerAndProcess(
		mediaSourceId: string,
		relativePath: string,
		contextMetadata?: Partial<MediaMetadataContext>,
		options?: MediaRegistrationOptions,
	): Promise<Media>;

	processTask(
		sourceId: string,
		mediaId: string,
		kind: FileTaskKind,
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
