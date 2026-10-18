import type {
	MediaProcessingInput,
	ProcessingListRequest,
	ProcessingRecoveryRequest,
	ProcessingRecoveryResponse,
} from "../processing/schemas";
import type { Transaction } from "../interfaces/transaction-manager";

export type ProcessingTarget = {
	input: MediaProcessingInput;
	fileName: string;
	sourceName: string;
};
export type IProcessingManagementRepository = {
	/** At most 100 local, applicable media; input cursor is stable while the result set shrinks. */
	scanPage(
		input: ProcessingRecoveryRequest,
		tx?: Transaction,
	): Promise<{
		items: (ProcessingTarget & { queued: boolean })[];
		cursor: ProcessingRecoveryResponse["cursor"];
	}>;
	list(
		input: ProcessingListRequest,
	): Promise<{ items: ProcessingTarget[]; total: number }>;
	findByMediaId(
		mediaId: string,
		tx?: Transaction,
	): Promise<ProcessingTarget | null>;
};
