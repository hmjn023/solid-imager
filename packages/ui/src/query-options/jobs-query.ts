import type {
	JobListRequest,
	JobListResponse,
} from "@solid-imager/core/domain/jobs/schemas";
import type { JobProgressEvent } from "@solid-imager/core/domain/sources/events";
import { queryOptions } from "@tanstack/solid-query";

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
	queryFn: (input: JobListRequest) => Promise<JobListResponse>,
) {
	return queryOptions({
		queryKey: jobsQueryKeys.list(input),
		queryFn: () => queryFn(input),
		...defaultJobsQueryConfig,
	});
}

export function updateJobProgress(
	data: JobListResponse | undefined,
	event: JobProgressEvent,
): JobListResponse | undefined {
	if (!data || !event.jobId) return data;

	let updated = false;
	const items = data.items.map((job) => {
		if (job.id !== event.jobId) return job;
		updated = true;
		return {
			...job,
			progress: {
				...(job.progress ?? { failed: 0 }),
				processed: event.processed,
				total: event.total,
			},
		};
	});

	return updated ? { ...data, items } : data;
}
