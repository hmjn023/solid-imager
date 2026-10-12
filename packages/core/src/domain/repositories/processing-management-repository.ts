import type {
	MediaProcessingInput,
	ProcessingListRequest,
} from "../processing/schemas";
import type { Transaction } from "../interfaces/transaction-manager";

export type ProcessingTarget = {
	input: MediaProcessingInput;
	fileName: string;
	sourceName: string;
};
export type IProcessingManagementRepository = {
	list(
		input: ProcessingListRequest,
	): Promise<{ items: ProcessingTarget[]; total: number }>;
	findByMediaId(
		mediaId: string,
		tx?: Transaction,
	): Promise<ProcessingTarget | null>;
};
