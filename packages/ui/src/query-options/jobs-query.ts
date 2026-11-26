import type {
	JobDto,
	JobListRequest,
	JobListResponse,
} from "@solid-imager/core/jobs";
import type { JobProgressEvent } from "@solid-imager/core/events";
import {
	infiniteQueryOptions,
	type InfiniteData,
	type QueryClient,
	type QueryFunctionContext,
} from "@tanstack/solid-query";

export const DEFAULT_JOBS_PAGE_SIZE = 200;
export const defaultJobsQueryInput = {
	limit: DEFAULT_JOBS_PAGE_SIZE,
	offset: 0,
} satisfies JobListRequest;

export const jobsQueryKeys = {
	all: () => ["jobs"] as const,
	listPrefix: () => ["jobs", "list"] as const,
	list: (input: JobListRequest) => ["jobs", "list", input] as const,
	infinitePrefix: () => ["jobs", "infinite"] as const,
	infinite: (input: Pick<JobListRequest, "status" | "type">) =>
		["jobs", "infinite", input] as const,
	types: () => ["jobs", "types"] as const,
	activeBatches: () => ["jobs", "activeBatches"] as const,
	targets: (jobId: string) => ["jobs", "targets", jobId] as const,
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

export function buildInfiniteJobsQueryOptions(
	input: Pick<JobListRequest, "status" | "type">,
	queryFn: (
		input: JobListRequest,
		signal: AbortSignal,
	) => Promise<JobListResponse>,
) {
	return infiniteQueryOptions({
		queryKey: jobsQueryKeys.infinite(input),
		initialPageParam: 0,
		queryFn: ({ signal, pageParam }) =>
			queryFn(
				{ ...input, limit: DEFAULT_JOBS_PAGE_SIZE, offset: pageParam },
				signal,
			),
		getNextPageParam: (page, pages, offset) =>
			page.items.length > 0 && offset + page.items.length < page.total
				? offset + page.items.length
				: undefined,
		...defaultJobsQueryConfig,
	});
}

/** Retain the newest occurrence if a live insertion moved a row across page boundaries. */
export function flattenJobPages(
	data: InfiniteData<JobListResponse> | undefined,
): JobListResponse | undefined {
	if (!data) return undefined;
	const rows = new Map<string, JobDto>();
	for (const page of data.pages)
		for (const job of page.items) {
			const previous = rows.get(job.id);
			if (!previous || job.updatedAt > previous.updatedAt)
				rows.set(job.id, job);
		}
	return { items: [...rows.values()], total: data.pages[0]?.total ?? 0 };
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
		const next = withProgress(job, event);
		updated ||= next !== job;
		return next;
	});

	return updated ? { ...data, items } : data;
}

function withProgress(job: JobDto, event: JobProgressEvent): JobDto {
	// A stage notification can arrive after the final job snapshot was fetched.
	if (event.importWork && job.status !== "in_progress") return job;
	return {
		...job,
		progress: {
			...job.progress,
			...(event.cancelled !== undefined && { cancelled: event.cancelled }),
			...(event.importWork && { importWork: event.importWork }),
			failed: event.failed ?? job.progress?.failed ?? 0,
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
	client.setQueriesData<InfiniteData<JobListResponse>>(
		{ queryKey: jobsQueryKeys.infinitePrefix() },
		(data) =>
			data
				? {
						...data,
						pages: data.pages.map(
							(page) => updateJobProgress(page, event) ?? page,
						),
					}
				: data,
	);
	if (event.jobId)
		client.setQueryData<JobDto>(jobsQueryKeys.detail(event.jobId), (job) =>
			job ? withProgress(job, event) : undefined,
		);
}
