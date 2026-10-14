import type { Transaction } from "../interfaces/transaction-manager";
import type {
	SourceRun,
	SourceRunInput,
	SourceRunKind,
	SourceRunClaim,
	SourceRunCheckpoint,
	SourceRunArtifact,
	SourceSyncWatermark,
} from "../source-runs/schemas";
export type ISourceRunRepository = {
	initialize(): Promise<{ migrated: number; blocked: number }>;
	assertDedicated(tx: Transaction): Promise<void>;
	requestSync(
		sourceId: string,
		sourcePath: string,
	): Promise<{ run: SourceRun; generation: number }>;
	watermark(sourceId: string): Promise<SourceSyncWatermark | null>;
	createTransfer(
		sourceId: string,
		input: Exclude<SourceRunInput, { kind: "sync" }>,
		id?: string,
	): Promise<SourceRun>;
	findById(id: string, tx?: Transaction): Promise<SourceRun | null>;
	findByIds(ids: string[], tx?: Transaction): Promise<SourceRun[]>;
	list(
		input: {
			sourceId?: string;
			kind?: SourceRunKind;
			status?: SourceRun["status"];
			limit: number;
			offset: number;
		},
		tx?: Transaction,
	): Promise<{ items: SourceRun[]; total: number }>;
	ensureSyncRuns(): Promise<void>;
	claimPending(
		kinds: SourceRunKind[],
		limit: number,
		sourceId?: string,
	): Promise<SourceRunClaim[]>;
	withActiveClaim<T>(
		claim: SourceRunClaim,
		action: (tx: Transaction, current: SourceRun) => Promise<T>,
	): Promise<T>;
	heartbeat(claim: SourceRunClaim): Promise<boolean>;
	checkpoint(
		claim: SourceRunClaim,
		checkpoint: SourceRunCheckpoint,
		tx: Transaction,
	): Promise<void>;
	complete(
		claim: SourceRunClaim,
		artifact?: SourceRunArtifact,
		publish?: (tx: Transaction) => Promise<void>,
	): Promise<SourceRun | null>;
	fail(
		claim: SourceRunClaim,
		code: string,
		blocked?: boolean,
	): Promise<SourceRun | null>;
	cancel(id: string): Promise<SourceRun>;
	retry(id: string): Promise<SourceRun>;
	cleanupExpired(
		limit: number,
		remove: (run: SourceRun) => Promise<void>,
	): Promise<number>;
	rollback(): Promise<{ restored: number }>;
};
