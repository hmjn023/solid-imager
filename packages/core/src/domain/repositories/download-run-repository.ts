import type { Transaction } from "../interfaces/transaction-manager";
import type {
	DownloadInput,
	DownloadRun,
	DownloadClaim,
	DownloadRegistrationCheckpoint,
	DownloadListRequest,
	DownloadCutoverReport,
} from "../downloads/schemas";
export type IDownloadRunRepository = {
	ensureCutover(): Promise<DownloadCutoverReport>;
	rollback(): Promise<number>;
	assertDedicated(tx: Transaction): Promise<void>;
	reserve(
		sourceId: string,
		items: DownloadInput[],
		tx: Transaction,
	): Promise<{ created: number; receipts: string[] }>;
	findById(id: string, tx?: Transaction): Promise<DownloadRun | null>;
	findByIds(ids: string[], tx?: Transaction): Promise<DownloadRun[]>;
	list(
		input: DownloadListRequest,
		tx: Transaction,
	): Promise<{ items: DownloadRun[]; total: number }>;
	claimPending(limit: number): Promise<DownloadClaim[]>;
	heartbeat(claim: DownloadClaim): Promise<boolean>;
	withActiveClaim<T>(
		claim: DownloadClaim,
		action: (tx: Transaction) => Promise<T>,
	): Promise<T>;
	saveCheckpoint(
		claim: DownloadClaim,
		checkpoint: DownloadRegistrationCheckpoint,
		tx: Transaction,
	): Promise<void>;
	settle(
		claim: DownloadClaim,
		outcome: "completed" | "failed" | "cancelled",
		error?: string,
	): Promise<DownloadRun | null>;
	retry(id: string): Promise<DownloadRun>;
	cancel(id: string): Promise<DownloadRun>;
};
