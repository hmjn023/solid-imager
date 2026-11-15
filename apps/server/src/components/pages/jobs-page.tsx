import { t } from "@solid-imager/i18n";
import { useWorkspaceNavigation } from "~/presentation/workspace-navigation";
import { useWorkspaceView } from "~/presentation/workspace-view";
import { useJobInspection, useJobsQueryEvents } from "@solid-imager/ui/jobs";
import { downloadCompletedJobArtifact } from "@solid-imager/client";
import type { JobListResponse } from "@solid-imager/core/jobs";
import {
	DEFAULT_JOBS_PAGE_SIZE,
	jobsQueryKeys,
	toQueryUiState,
} from "@solid-imager/ui/query";
import { JobsScreen } from "@solid-imager/ui/screens/jobs";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import { buildThumbnailUrl } from "~/components/media/thumbnail-image";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { jobsQueryOptions } from "~/infrastructure/api-clients/queries";

const BULK_RETRY_CONCURRENCY = 8;

export function JobsPage() {
	const [pageIndex, setPageIndex] = createSignal(0);
	const jobsQuery = createQuery<JobListResponse>(() =>
		jobsQueryOptions({
			limit: DEFAULT_JOBS_PAGE_SIZE,
			offset: pageIndex() * DEFAULT_JOBS_PAGE_SIZE,
		}),
	);
	const workspace = useWorkspaceNavigation();
	const inspection = useJobInspection(
		workspace.selectedJobId,
		jobsQuery,
		(id, signal) => orpc.jobs.get({ id }, { signal }),
		(jobId) => void workspace.open({ kind: "job", jobId }),
	);
	useWorkspaceView(() => ({
		kind: "jobs",
		job: inspection.job(),
		failed: inspection.failed(),
	}));
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

	useJobsQueryEvents((signal) => orpc.jobs.events(undefined, { signal }));

	return (
		<JobsScreen
			inspection={inspection}
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
					toast.success(t("jobs.jobQueuedForRetry"));
				} catch (error) {
					toast.error(
						error instanceof Error ? error.message : t("jobs.failedToRetryJob"),
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
						t("jobs.valueOfValueJobsFailedToQueueForRetry", {
							value0: String(failedCount),
							value1: String(jobIds.length),
						}),
					);
					throw firstError instanceof Error
						? firstError
						: new Error(t("jobs.failedToRetrySomeJobs"));
				}
				toast.success(
					t("jobs.valueJobsQueuedForRetry", { value0: String(jobIds.length) }),
				);
			}}
			onCancel={async (jobId) => {
				try {
					await orpc.jobs.cancel({ id: jobId });
					await queryClient.invalidateQueries({
						queryKey: jobsQueryKeys.all(),
					});
					toast.success(t("jobs.jobCancellationRequested"));
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: t("jobs.failedToCancelJob"),
					);
					throw error;
				}
			}}
			onDownload={(job) => {
				const artifact = job.artifact;
				if (!artifact) return;
				return (async () => {
					try {
						const blob = await downloadCompletedJobArtifact(orpc.jobs, job.id);
						const url = URL.createObjectURL(blob);
						const anchor = document.createElement("a");
						anchor.href = url;
						anchor.download = artifact.fileName;
						document.body.appendChild(anchor);
						anchor.click();
						anchor.remove();
						setTimeout(() => URL.revokeObjectURL(url), 0);
						toast.success(
							t("manager.downloadedValue", {
								value0: String(artifact.fileName),
							}),
						);
					} catch (error) {
						toast.error(
							error instanceof Error
								? error.message
								: t("jobs.failedToDownloadArtifact"),
						);
						throw error;
					}
				})();
			}}
			page={pagination}
			state={() => toQueryUiState(jobsQuery)}
		/>
	);
}
