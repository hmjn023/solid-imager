export type JobStatus = "pending" | "in_progress" | "completed" | "failed";

export type JobRecord = {
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
};

export type NewJobRecord = {
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
};

export type FindPendingJobsOptions = {
	excludeTypes?: string[];
	includeTypes?: string[];
};

export type JobRepositoryPort = {
	create(job: NewJobRecord): Promise<JobRecord>;
	createMany(jobs: NewJobRecord[]): Promise<JobRecord[]>;
	createIfUnique(job: NewJobRecord): Promise<JobRecord | null>;
	findById(id: string): Promise<JobRecord | null>;
	findPendingImportRequests(): Promise<JobRecord[]>;
	findImportRequestsByIds(jobIds: string[]): Promise<JobRecord[]>;
	findPending(
		limit: number,
		options?: FindPendingJobsOptions,
	): Promise<JobRecord[]>;
	resetInProgressToPending(options?: {
		includeTypes?: string[];
	}): Promise<void>;
	markImportRequestsCompleted(jobIds: string[]): Promise<void>;
	markImportRequestsFailed(jobIds: string[], error: string): Promise<void>;
	deleteImportRequests(jobIds: string[]): Promise<void>;
	markAsInProgress(id: string): Promise<void>;
	markAsCompleted(id: string, result?: unknown): Promise<void>;
	markAsFailed(id: string, error: string): Promise<void>;
	update(id: string, data: Partial<JobRecord>): Promise<void>;
	incrementProgress(id: string): Promise<void>;
};

export type ProcessMediaJobRepository = {
	create(job: NewJobRecord): Promise<unknown>;
};
