import type {
	JobListRequest,
	JobListResponse,
} from "@solid-imager/core/domain/jobs/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const jobsQueryKeys = {
	all: () => ["jobs"] as const,
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
