import type { Transaction } from "../interfaces/transaction-manager";
import type { TaggingResponse } from "../tagging/schemas";
import type {
	MediaProcessingClaim,
	MediaProcessingInput,
	MediaProcessingState,
	MediaTaskKind,
	ProcessingOwner,
	MediaProcessingRequest,
	ScheduledMediaWork,
} from "../processing/schemas";

export type ProcessingClaimResult =
	| { status: "completed"; state: MediaProcessingState }
	| { status: "busy" }
	| {
			status: "claimed";
			claim: MediaProcessingClaim;
			state: MediaProcessingState;
	  };

export type IMediaProcessingSchedulerRepository =
	IMediaProcessingStateRepository & {
		findInlineMediaIds(
			afterId: string | undefined,
			limit: number,
			taskKinds?: MediaTaskKind[],
		): Promise<string[]>;
		/** Explicit authority transfer. Callers must quiesce/reconcile old producers first. */
		request(
			request: MediaProcessingRequest,
			tx: Transaction,
		): Promise<MediaProcessingState>;
		claimDue(
			taskKinds: MediaTaskKind[],
			tx: Transaction,
		): Promise<ScheduledMediaWork | null>;
		recoverExpired(
			taskKinds: MediaTaskKind[],
			limit: number,
			tx: Transaction,
		): Promise<number>;
		settleFailure(
			claim: MediaProcessingClaim,
			error: string,
			retryable: boolean,
			tx: Transaction,
		): Promise<MediaProcessingState | null>;
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
	findByMediaIds(
		mediaIds: string[],
		tx?: Transaction,
	): Promise<MediaProcessingState[]>;
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
