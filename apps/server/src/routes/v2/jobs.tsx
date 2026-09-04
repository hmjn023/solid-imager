import type { JobListResponse } from "@solid-imager/core/domain/jobs/schemas";
import { useJobEvents } from "@solid-imager/ui/hooks/use-job-events";
import {
	DEFAULT_JOBS_PAGE_SIZE,
	jobsQueryKeys,
	updateJobProgress,
} from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { V2JobsScreen } from "@solid-imager/ui/screens/v2-jobs-screen";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { buildThumbnailUrl } from "~/components/media/thumbnail-image";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { jobsQueryOptions } from "~/infrastructure/api-clients/queries";

const BULK_RETRY_CONCURRENCY = 8;

export const Route = createFileRoute("/v2/jobs")({
	component: V2JobsRoute,
});

function V2JobsRoute() {
	const [pageIndex, setPageIndex] = createSignal(0);
	const jobsQuery = createQuery<JobListResponse>(() =>
		jobsQueryOptions({
			limit: DEFAULT_JOBS_PAGE_SIZE,
			offset: pageIndex() * DEFAULT_JOBS_PAGE_SIZE,
		}),
	);
	const queryClient = useQueryClient();
	const pagination = () => {
		const total = jobsQuery.data?.total ?? 0;
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
		<V2JobsScreen
			buildThumbnailUrl={buildThumbnailUrl}
			isRefreshing={() => jobsQuery.isFetching}
			jobs={() => jobsQuery.data?.items ?? []}
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
			onRetryMany={async (jobIds) => {
				let failedCount = 0;
				let firstError: unknown;
				for (
					let index = 0;
					index < jobIds.length;
					index += BULK_RETRY_CONCURRENCY
				) {
					const results = await Promise.allSettled(
						jobIds
							.slice(index, index + BULK_RETRY_CONCURRENCY)
							.map((jobId) => orpc.jobs.retry({ id: jobId })),
					);
					for (const result of results) {
						if (result.status === "rejected") {
							failedCount += 1;
							if (firstError === undefined) {
								firstError = result.reason;
							}
						}
					}
				}
				await queryClient.invalidateQueries({
					queryKey: jobsQueryKeys.all(),
				});
				if (failedCount > 0) {
					toast.error(
						`${failedCount} of ${jobIds.length} jobs failed to queue for retry`,
					);
					throw firstError instanceof Error
						? firstError
						: new Error("Failed to retry some jobs");
				}
				toast.success(`${jobIds.length} jobs queued for retry`);
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
			onDownload={(job) => {
				if (!job.artifact) return;
				const anchor = document.createElement("a");
				anchor.href = `/api/jobs/${encodeURIComponent(job.id)}/artifact`;
				anchor.download = job.artifact.fileName;
				anchor.rel = "noopener";
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
			}}
			page={pagination}
			state={() => toQueryUiState(jobsQuery)}
		/>
	);
}
