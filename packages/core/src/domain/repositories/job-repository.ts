export type JobStatus =
	| "pending"
	| "in_progress"
	| "completed"
	| "failed"
	| "cancelled";

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

export type BatchProgress = {
	processed: number;
	failed: number;
	total: number;
};

export type IJobRepository = {
	create(job: NewJob): Promise<Job>;
	createIfUnique(job: NewJob): Promise<Job | null>;
	findById(id: string): Promise<Job | null>;
	findPending(
		limit: number,
		options?: {
			excludeTypes?: string[];
			includeTypes?: string[];
			excludeLanceDbSourceIds?: string[];
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
			excludeLanceDbSourceIds?: string[];
		},
	): Promise<Job[]>;
	requeueStaleInProgress(olderThan: Date): Promise<number>;
};
