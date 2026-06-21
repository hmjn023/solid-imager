export type JobStatus = "pending" | "in_progress" | "completed" | "failed";

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
	markAsCompleted(id: string, result?: unknown): Promise<void>;
	markAsFailed(id: string, error: string): Promise<void>;
	update(id: string, data: Partial<Job>): Promise<void>;
	incrementProgress(id: string): Promise<void>;
};
