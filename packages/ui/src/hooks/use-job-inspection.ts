import type { JobDto, JobListResponse } from "@solid-imager/core/jobs";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, type Accessor } from "solid-js";
import { jobsQueryKeys } from "../query-options/jobs-query";

// A linked job can be outside the loaded page. Prefer the live row when it is available.
/** Uses the live list row when available, otherwise fetches the selected job independently of pagination. */
export function useJobInspection(
	id: Accessor<string | undefined>,
	list: { data: JobListResponse | undefined; isPending: boolean },
	getJob: (id: string, signal: AbortSignal) => Promise<JobDto>,
	select: (jobId: string) => void,
) {
	const row = createMemo(() => list.data?.items.find((job) => job.id === id()));
	const detail = createQuery(() => {
		const jobId = id();
		return {
			queryKey: jobsQueryKeys.detail(jobId ?? ""),
			enabled: !!jobId && !row(),
			queryFn: ({ signal }: { signal: AbortSignal }) => {
				if (!jobId) throw new Error("No job selected");
				return getJob(jobId, signal);
			},
		};
	});
	return {
		select,
		job: () => row() ?? (detail.data?.id === id() ? detail.data : undefined),
		failed: () => !!id() && !row() && detail.isError,
		retry: () => {
			void detail.refetch();
		},
	};
}
