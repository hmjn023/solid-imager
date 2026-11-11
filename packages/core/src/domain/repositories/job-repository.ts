import type {
	JobStatus,
	JobAttemptOutcome,
	JobTerminalStatus,
} from "../jobs/schemas";

/** Persisted job state, including cancellation, retry and optional artifact metadata. */
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
	cancelRequestedAt?: Date | null;
	cancelledAt?: Date | null;
	attemptCount?: number;
	startedAt?: Date | null;
	finishedAt?: Date | null;
	artifactPath?: string | null;
	artifactFileName?: string | null;
	artifactContentType?: string | null;
	artifactSize?: number | null;
	artifactExpiresAt?: Date | null;
};

/** Job creation fields; the repository supplies omitted defaults. */
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
	cancelRequestedAt?: Date | null;
	cancelledAt?: Date | null;
	attemptCount?: number;
	startedAt?: Date | null;
	finishedAt?: Date | null;
	artifactPath?: string | null;
	artifactFileName?: string | null;
	artifactContentType?: string | null;
	artifactSize?: number | null;
	artifactExpiresAt?: Date | null;
};

/** Progress counters for a parent batch job. */
export type BatchProgress = {
	processed: number;
	failed: number;
	total: number;
};

/** Port for job persistence, claiming, cancellation and batch progress updates. */
export type IJobRepository = {
	create(job: NewJob): Promise<Job>;
	/** Creates the non-executable parent and its dispatch request in one transaction. */
	createBatch(parent: NewJob, dispatch: Omit<NewJob, "parentId">): Promise<Job>;
	/** Resolves cancellation and the proposed outcome in a single CAS; null means this attempt no longer owns the job. */
	finishAttempt(
		id: string,
		attemptCount: number,
		outcome: JobAttemptOutcome,
	): Promise<JobTerminalStatus | null>;
	/** Finalizes an open aggregate only after its known item count is accounted for. */
	finishBatch(id: string): Promise<JobTerminalStatus | null>;
	createIfUnique(job: NewJob): Promise<Job | null>;
	findById(id: string): Promise<Job | null>;
	findPending(
		limit: number,
		options?: {
			excludeTypes?: string[];
			includeTypes?: string[];
		},
	): Promise<Job[]>;
	markAsInProgress(id: string): Promise<void>;
	markAsCompleted(
		id: string,
		result: unknown,
		attemptCount: number,
	): Promise<boolean>;
	markAsFailed(
		id: string,
		error: string,
		attemptCount: number,
	): Promise<boolean>;
	requestCancellation(id: string): Promise<void>;
	markAsCancelled(
		id: string,
		reason: string | undefined,
		attemptCount: number,
	): Promise<boolean>;
	isCancellationRequested(id: string): Promise<boolean>;
	setArtifact(
		id: string,
		artifact: {
			path: string;
			fileName: string;
			contentType: string;
			size: number;
			expiresAt: Date;
		},
	): Promise<void>;
	update(id: string, data: Partial<Job>): Promise<void>;
	setBatchTotal(parentId: string, total: number): Promise<BatchProgress>;
	recordBatchChildOutcome(
		parentId: string,
		childId: string,
		attempt: number,
		processed: number,
		failed: number,
	): Promise<BatchProgress | null>;
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
	claimPending(
		limit: number,
		options?: {
			excludeTypes?: string[];
			includeTypes?: string[];
		},
	): Promise<Job[]>;
	requeueStaleInProgress(olderThan: Date): Promise<number>;
};
