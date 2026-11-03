import type {
	JobDto,
	JobListRequest,
	JobListResponse,
} from "@solid-imager/core/jobs";
import type { JobProgressEvent } from "@solid-imager/core/events";
import type { QueryClient, QueryFunctionContext } from "@tanstack/solid-query";

export const DEFAULT_JOBS_PAGE_SIZE = 200;
export const defaultJobsQueryInput = {
	limit: DEFAULT_JOBS_PAGE_SIZE,
	offset: 0,
} satisfies JobListRequest;

export const jobsQueryKeys = {
	all: () => ["jobs"] as const,
	listPrefix: () => ["jobs", "list"] as const,
	list: (input: JobListRequest) => ["jobs", "list", input] as const,
	detail: (jobId: string) => ["jobs", "detail", jobId] as const,
};

export const defaultJobsQueryConfig = {
	staleTime: 5_000,
};

export function buildJobsQueryOptions(
	input: JobListRequest,
	queryFn: (
		input: JobListRequest,
		signal: AbortSignal,
	) => Promise<JobListResponse>,
) {
	return {
		queryKey: jobsQueryKeys.list(input),
		queryFn: ({ signal }: QueryFunctionContext) => queryFn(input, signal),
		...defaultJobsQueryConfig,
	};
}

/**
 * Updates the matching cached list row without changing unrelated rows.
 *
 * @param data - Cached job page, if present.
 * @param event - Progress event identifying the job and its processed and total counts.
 * @returns Updated data, or the original reference if no matching row exists.
 */
export function updateJobProgress(
	data: JobListResponse | undefined,
	event: JobProgressEvent,
): JobListResponse | undefined {
	if (!data || !event.jobId) return data;

	let updated = false;
	const items = data.items.map((job) => {
		if (job.id !== event.jobId) return job;
		updated = true;
		return withProgress(job, event);
	});

	return updated ? { ...data, items } : data;
}

function withProgress(job: JobDto, event: JobProgressEvent): JobDto {
	return {
		...job,
		progress: {
			...(job.progress ?? { failed: 0 }),
			processed: event.processed,
			total: event.total,
		},
	};
}

/** Applies progress to all cached job lists and the matching detail, without creating missing cache entries. */
export function updateCachedJobProgress(
	client: QueryClient,
	event: JobProgressEvent,
) {
	client.setQueriesData<JobListResponse>(
		{ queryKey: jobsQueryKeys.listPrefix() },
		(data) => updateJobProgress(data, event),
	);
	if (event.jobId)
		client.setQueryData<JobDto>(jobsQueryKeys.detail(event.jobId), (job) =>
			job ? withProgress(job, event) : undefined,
		);
}
