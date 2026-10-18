import { downloadCompletedJobArtifact } from "@solid-imager/client";
import type {
	JobDto,
	JobListResponse,
} from "@solid-imager/core/domain/jobs/schemas";
import { useJobEvents } from "@solid-imager/ui/hooks/use-job-events";
import {
	DEFAULT_JOBS_PAGE_SIZE,
	jobsQueryKeys,
	updateJobProgress,
} from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { JobsScreen } from "@solid-imager/ui/screens/jobs-screen";
import { mutateSelectedJobs } from "@solid-imager/ui/screens/jobs-mutations";
import type { JobBulkAction } from "@solid-imager/ui/screens/jobs-selection";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { batch, createEffect, createSignal } from "solid-js";
import {
	jobsSearchSchema,
	type JobFilter,
} from "@solid-imager/ui/screens/jobs-view";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { buildThumbnailUrl } from "~/infrastructure/media/thumbnail-runtime";
import { jobsQueryOptions } from "~/queries";

export const Route = createFileRoute("/jobs")({
	validateSearch: jobsSearchSchema,
	loader: ({ context }) => {
		void context.queryClient.query(jobsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
	},
	component: JobsRoute,
});

async function downloadJobArtifact(job: JobDto): Promise<void> {
	if (!job.artifact) return;

	try {
		const blob = await downloadCompletedJobArtifact(orpc.jobs, job.id);
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = job.artifact.fileName;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
		toast.success(`Downloaded ${job.artifact.fileName}`);
	} catch (error) {
		toast.error(
			error instanceof Error ? error.message : "Failed to download artifact",
		);
		throw error;
	}
}

function JobsRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const [pageIndex, setPageIndex] = createSignal(0);
	const [filter, setFilter] = createSignal<JobFilter>("all");
	const jobsQuery = createQuery<JobListResponse>(() => {
		const status = filter();
		return jobsQueryOptions({
			status: status === "all" ? undefined : status,
			limit: DEFAULT_JOBS_PAGE_SIZE,
			offset: pageIndex() * DEFAULT_JOBS_PAGE_SIZE,
		});
	});
	const queryClient = useQueryClient();
	const state = () => toQueryUiState(jobsQuery);
	createEffect(() => {
		const total = state().data?.total;
		if (total !== undefined)
			setPageIndex((current) =>
				Math.min(
					current,
					Math.max(0, Math.ceil(total / DEFAULT_JOBS_PAGE_SIZE) - 1),
				),
			);
	});
	const pagination = () => {
		const total = state().data?.total ?? 0;
		return {
			canNext: (pageIndex() + 1) * DEFAULT_JOBS_PAGE_SIZE < total,
			canPrevious: pageIndex() > 0,
			current: pageIndex() + 1,
			onNext: () => setPageIndex((current) => current + 1),
			onPrevious: () => setPageIndex((current) => Math.max(0, current - 1)),
			total: Math.max(1, Math.ceil(total / DEFAULT_JOBS_PAGE_SIZE)),
		};
	};

	useJobEvents(
		(signal) => orpc.jobs.events(undefined, { signal }),
		(event) => {
			if (event.event === "job-progress") {
				queryClient.setQueriesData<JobListResponse>(
					{ queryKey: jobsQueryKeys.listPrefix() },
					(data) => updateJobProgress(data, event.data),
				);
				return;
			}
			void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
		},
	);

	return (
		<JobsScreen
			filter={filter}
			onFilterChange={(value) =>
				batch(() => {
					setPageIndex(0);
					setFilter(value);
				})
			}
			view={() => search().view}
			onViewChange={(view) => {
				void navigate({ search: { view }, replace: true });
			}}
			processingApi={{
				listSources: () => orpc.sources.list(),
				scanRecovery: (input, signal) =>
					orpc.processing.scanRecovery(input, { signal }),
				enqueueRecovery: (input, signal) =>
					orpc.processing.enqueueRecovery(input, { signal }),
				request: (input) => orpc.processing.request(input),
				list: (input) => orpc.processing.list(input),
				get: (input) => orpc.processing.get(input),
				retry: (input) => orpc.processing.retry(input),
				openEvents: (signal) => orpc.sources.events({ id: "*" }, { signal }),
			}}
			buildThumbnailUrl={buildThumbnailUrl}
			isRefreshing={() => jobsQuery.isFetching}
			jobs={() => state().data?.items ?? []}
			retryFailedPage={(input, signal) =>
				orpc.jobs.retryFailed(input, { signal })
			}
			onRefresh={async () => {
				await jobsQuery.refetch();
			}}
			onRetry={async (jobId) => {
				try {
					await orpc.jobs.retry({ id: jobId });
					await queryClient.invalidateQueries({
						queryKey: jobsQueryKeys.all(),
					});
					toast.success("Job queued for retry");
				} catch (error) {
					toast.error(
						error instanceof Error ? error.message : "Failed to retry job",
					);
					throw error;
				}
			}}
			onMutateMany={async (action: JobBulkAction, jobIds) => {
				const result = await mutateSelectedJobs(orpc.jobs, action, jobIds);
				await queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
				const verb = {
					retry: "queued for retry",
					cancel: "cancellation requested",
					delete: "history deleted",
				}[action];
				if (result.succeeded)
					toast.success(`${result.succeeded} jobs: ${verb}`);
				if (result.failed.length)
					toast.error(`${result.failed.length} jobs could not be changed`);
				return result;
			}}
			onCancel={async (jobId) => {
				try {
					await orpc.jobs.cancel({ id: jobId });
					await queryClient.invalidateQueries({
						queryKey: jobsQueryKeys.all(),
					});
					toast.success("Job cancellation requested");
				} catch (error) {
					toast.error(
						error instanceof Error ? error.message : "Failed to cancel job",
					);
					throw error;
				}
			}}
			onDownload={downloadJobArtifact}
			page={pagination}
			state={state}
		/>
	);
}
