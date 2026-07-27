import type { JobQueueName, JobStatus } from "../jobs/schemas";

export type { JobStatus } from "../jobs/schemas";

export type Job = {
  id: string;
  type: string;
  mediaSourceId: string | null;
  status: JobStatus;
  payload: unknown;
  result: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  queueName: JobQueueName | null;
  targetId: string | null;
  inputRevision: string | null;
  dedupeKey: string | null;
  concurrencyKey: string | null;
  availableAt: Date;
  attemptCount: number;
  maxAttempts: number;
  leaseDurationMs: number;
  claimToken: string | null;
  claimedBy: string | null;
  claimedAt: Date | null;
  heartbeatAt: Date | null;
  errorCode: string | null;
};

export type NewJob = {
  id?: string;
  type: string;
  mediaSourceId?: string | null;
  status?: JobStatus;
  payload?: unknown;
  result?: unknown;
  error?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  parentId?: string | null;
  queueName?: JobQueueName | null;
  targetId?: string | null;
  inputRevision?: string | null;
  dedupeKey?: string | null;
  concurrencyKey?: string | null;
  availableAt?: Date;
  attemptCount?: number;
  maxAttempts?: number;
  leaseDurationMs?: number;
  claimToken?: string | null;
  claimedBy?: string | null;
  claimedAt?: Date | null;
  heartbeatAt?: Date | null;
  errorCode?: string | null;
};

export type BatchProgress = {
	processed: number;
	failed: number;
	total: number;
};

export type BatchReconciliation = BatchProgress & {
	status: JobStatus;
	transitioned: boolean;
};

export type ClaimFence = {
  claimToken: string;
  inputRevision: string | null;
};

export type ClaimOptions = {
  excludeTypes?: string[];
  includeTypes?: string[];
  excludeLanceDbSourceIds?: string[];
  queueNames?: JobQueueName[];
  workerId?: string;
  now?: Date;
};

export type ClaimFailure = {
  error: string;
  errorCode: string;
  retryable: boolean;
  retryAt?: Date;
};

export type ClaimFailureResult = {
  status: "pending" | "failed";
  attemptCount: number;
};

export type IJobRepository = {
	create(job: NewJob): Promise<Job>;
	createIfUnique(job: NewJob): Promise<Job | null>;
	createParentWithDispatch(parent: NewJob, dispatch: NewJob): Promise<Job>;
  findById(id: string): Promise<Job | null>;
  findPending(limit: number, options?: ClaimOptions): Promise<Job[]>;
  markAsInProgress(id: string): Promise<void>;
  markAsCompleted(id: string, result?: unknown): Promise<void>;
  markAsFailed(id: string, error: string): Promise<void>;
  update(id: string, data: Partial<Job>): Promise<void>;
  heartbeatClaim(id: string, fence: ClaimFence, at?: Date): Promise<boolean>;
  completeClaim(id: string, fence: ClaimFence, result?: unknown): Promise<boolean>;
  failClaim(
    id: string,
    fence: ClaimFence,
    failure: ClaimFailure,
  ): Promise<ClaimFailureResult | null>;
  releaseClaim(id: string, fence: ClaimFence, availableAt?: Date): Promise<boolean>;
  incrementProgress(
    id: string,
    progressKey?: string,
    amount?: number,
  ): Promise<BatchProgress | null>;
  incrementFailedCount(
    id: string,
    progressKey?: string,
    amount?: number,
  ): Promise<BatchProgress | null>;
	recomputeBatchProgress(id: string): Promise<BatchReconciliation | null>;
  claimPending(limit: number, options?: ClaimOptions): Promise<Job[]>;
  requeueExpiredLeases(now?: Date): Promise<number>;
  /** @deprecated Use requeueExpiredLeases; retained for maintenance compatibility. */
  requeueStaleInProgress(olderThan: Date): Promise<number>;
};
