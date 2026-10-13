import type { Transaction } from "../interfaces/transaction-manager";
import type { MediaProcessingState } from "../processing/schemas";
import type {
	BatchRun,
	BatchClaim,
	BatchInput,
	BatchItem,
	BatchProgress,
	SafeBatchAttempt,
} from "../batches/schemas";

export type BatchTarget = Pick<
	BatchItem,
	"mediaId" | "mediaSourceId" | "kind" | "input" | "plannedRevision"
>;
export type BatchSummary = { run: BatchRun; progress: BatchProgress };
export type IBatchRunRepository = {
	initialize(): Promise<{ migrated: number; blocked: number }>;
	assertDedicated(tx: Transaction): Promise<void>;
	beginCapture(input: BatchInput, tx: Transaction): Promise<BatchRun>;
	appendTargets(
		id: string,
		targets: BatchTarget[],
		tx: Transaction,
	): Promise<void>;
	sealCapture(id: string, tx: Transaction): Promise<BatchSummary>;
	findById(id: string, tx?: Transaction): Promise<BatchSummary | null>;
	resolveId(id: string, tx?: Transaction): Promise<string | null>;
	findItem(id: string, tx?: Transaction): Promise<BatchItem | null>;
	findItemsByIds(ids: string[], tx?: Transaction): Promise<BatchItem[]>;
	retryItem(id: string): Promise<BatchSummary>;
	listAttempts(
		id: string,
		limit: number,
		offset: number,
	): Promise<{ items: SafeBatchAttempt[]; total: number }>;
	findByIds(ids: string[], tx?: Transaction): Promise<BatchSummary[]>;
	list(
		input: { status?: BatchRun["status"]; limit: number; offset: number },
		tx?: Transaction,
	): Promise<{ items: BatchSummary[]; total: number }>;
	listItems(
		id: string,
		limit: number,
		offset: number,
	): Promise<{ items: BatchItem[]; total: number }>;
	claimPending(limit: number): Promise<BatchClaim[]>;
	withActiveClaim<T>(
		claim: BatchClaim,
		action: (tx: Transaction) => Promise<T>,
	): Promise<T>;
	pendingItems(
		claim: BatchClaim,
		limit: number,
		tx: Transaction,
	): Promise<BatchItem[]>;
	bindItem(
		claim: BatchClaim,
		item: BatchItem,
		state: MediaProcessingState,
		tx: Transaction,
	): Promise<void>;
	failItem(
		claim: BatchClaim,
		item: BatchItem,
		code: "input_changed" | "processing_failed",
		tx: Transaction,
	): Promise<void>;
	finishDispatch(claim: BatchClaim, tx: Transaction): Promise<void>;
	reconcile(limit: number): Promise<BatchSummary[]>;
	cancel(id: string): Promise<BatchSummary>;
	retry(id: string): Promise<BatchSummary>;
	rollback(): Promise<{ restored: number }>;
};
