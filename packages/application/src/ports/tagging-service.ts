import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	ProcessingOwner,
	MediaProcessingInput,
	MediaProcessingState,
	ProcessingRequestIdentity,
} from "@solid-imager/core/domain/processing/schemas";
import type {
	CcipFeatureResponse,
	TaggingResponse,
} from "@solid-imager/core/domain/tagging/schemas";

export interface ITaggingService {
	requestTags(
		sourceId: string,
		mediaId: string,
		force?: boolean,
		tx?: Transaction,
	): Promise<MediaProcessingState>;
	reserveTagsForJob(
		owner: ProcessingOwner,
		sourceId: string,
		mediaIds: string[],
		force?: boolean,
	): Promise<Record<string, ProcessingRequestIdentity>>;
	runTaggingTask(): Promise<
		"idle" | "completed" | "retry" | "failed" | "superseded"
	>;
	reconcileTaggingTasks(): Promise<void>;
	inferCcip(input: MediaProcessingInput): Promise<CcipFeatureResponse>;
	isServiceAvailable(): Promise<boolean>;
	getTags(imageBuffer: ArrayBuffer): Promise<TaggingResponse>;
	getTagsForMedia(
		mediaSourceId: string,
		mediaId: string,
		options?: {
			skipCache?: boolean;
			owner?: ProcessingOwner;
			request?: ProcessingRequestIdentity;
		},
	): Promise<TaggingResponse | null>;
	getCcipFeature(imageBuffer: ArrayBuffer): Promise<CcipFeatureResponse>;
	getCcipFeatureForMedia(
		mediaSourceId: string,
		mediaId: string,
	): Promise<CcipFeatureResponse>;
	getCcipDifference(feature1: number[], feature2: number[]): Promise<number>;
	getCcipDistances(
		feature: number[],
		candidates: number[][],
	): Promise<number[]>;
}
