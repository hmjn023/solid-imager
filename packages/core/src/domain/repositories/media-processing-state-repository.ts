import type { Transaction } from "../interfaces/transaction-manager";
import type { TaggingResponse } from "../tagging/schemas";
import type {
	MediaProcessingClaim,
	MediaProcessingInput,
	MediaProcessingState,
	MediaTaskKind,
	ProcessingOwner,
} from "../processing/schemas";

export type ProcessingClaimResult =
	| { status: "completed"; state: MediaProcessingState }
	| { status: "busy" }
	| {
			status: "claimed";
			claim: MediaProcessingClaim;
			state: MediaProcessingState;
	  };

export type IMediaProcessingStateRepository = {
	findTaggingResult(
		mediaId: string,
		revision: string,
		tx: Transaction,
	): Promise<TaggingResponse | null>;
	/** Called inside commit: caches only the currently fenced tagging claim. */
	saveTaggingResult(
		claim: MediaProcessingClaim,
		result: TaggingResponse,
		tx: Transaction,
	): Promise<void>;
	findByMediaIds(mediaIds: string[]): Promise<MediaProcessingState[]>;
	claim(
		input: MediaProcessingInput,
		taskKind: MediaTaskKind,
		revision: string,
		owner: ProcessingOwner | null,
		force: boolean,
		tx: Transaction,
	): Promise<ProcessingClaimResult>;
	commit(
		input: MediaProcessingInput,
		claim: MediaProcessingClaim,
		output: (tx: Transaction) => Promise<void>,
		tx: Transaction,
	): Promise<void>;
	fail(
		claim: MediaProcessingClaim,
		error: string,
		tx: Transaction,
	): Promise<boolean>;
	heartbeat(claim: MediaProcessingClaim): Promise<boolean>;
};
