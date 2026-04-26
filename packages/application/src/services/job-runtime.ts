import type { JobRecord, JobRepositoryPort, NewJobRecord } from "../ports/job-repository";

export const CANONICAL_JOB_TYPES = [
	"processMedia",
	"downloadImage",
	"auto_tagging",
	"bulk_tagging_dispatch",
	"bulk_tagging_parent",
	"import_request",
] as const;

export type CanonicalJobType = (typeof CANONICAL_JOB_TYPES)[number];

export const AI_JOB_TYPES = ["auto_tagging"] as const;
export const NON_RUNNABLE_JOB_TYPES = ["import_request", "bulk_tagging_parent"] as const;

export type RunnableJobType = Exclude<CanonicalJobType, (typeof NON_RUNNABLE_JOB_TYPES)[number]>;

export type DeferredJob = {
	mediaId?: string;
	sourcePath?: string;
	type: "processMedia" | "downloadImage";
	payload?: unknown;
};

export type DeferredJobs = {
	mediaSourceId: string;
	jobs: DeferredJob[];
};

export type DeferredEvent = {
	mediaSourceId: string;
	event: string;
	payload: unknown;
};

export type DeferredActions = {
	jobs: DeferredJobs[];
	sse: DeferredEvent[];
};

export type JobRuntimeLogger = {
	warn?(data: unknown, message?: string): void;
};

export type RunnableJobProcessor = (job: JobRecord) => Promise<void>;

export type JobRuntimeProcessors = {
	[K in RunnableJobType]?: RunnableJobProcessor;
};

export type DeferredActionExecutorDeps = {
	jobRepository: Pick<JobRepositoryPort, "create">;
	publishEvent?: (event: DeferredEvent) => Promise<void> | void;
};

const nonRunnableJobTypes = new Set<string>(NON_RUNNABLE_JOB_TYPES);

export function isNonRunnableJobType(type: string): boolean {
	return nonRunnableJobTypes.has(type);
}

export function createJobDispatcher(
	processors: JobRuntimeProcessors,
	logger?: JobRuntimeLogger,
): RunnableJobProcessor {
	return async (job) => {
		if (isNonRunnableJobType(job.type)) {
			logger?.warn?.({ jobId: job.id, type: job.type }, "Skipping non-runnable job type");
			return;
		}

		const processor = processors[job.type as RunnableJobType];
		if (!processor) {
			throw new Error(`No processor registered for job type: ${job.type}`);
		}

		await processor(job);
	};
}

export async function executeDeferredActions(
	actions: DeferredActions,
	deps: DeferredActionExecutorDeps,
): Promise<void> {
	for (const item of actions.jobs) {
		for (const job of item.jobs) {
			const payload = typeof job.payload === "object" && job.payload !== null ? job.payload : {};
			const newJob: NewJobRecord = {
				type: job.type,
				mediaSourceId: item.mediaSourceId,
				payload: {
					...payload,
					mediaId: job.mediaId,
					sourcePath: job.sourcePath,
				},
			};
			await deps.jobRepository.create(newJob);
		}
	}

	for (const event of actions.sse) {
		await deps.publishEvent?.(event);
	}
}
