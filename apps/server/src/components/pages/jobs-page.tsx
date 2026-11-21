import { t } from "@solid-imager/i18n";
import { useWorkspaceNavigation } from "~/presentation/workspace-navigation";
import { useWorkspaceView } from "~/presentation/workspace-view";
import {
	useJobInspection,
	useJobsList,
	useJobsQueryEvents,
} from "@solid-imager/ui/jobs";
import { downloadCompletedJobArtifact } from "@solid-imager/client";
import { jobsQueryKeys } from "@solid-imager/ui/query";
import { JobsScreen } from "@solid-imager/ui/screens/jobs";
import { toast } from "@solid-imager/ui/toast";
import { useQueryClient } from "@tanstack/solid-query";
import { buildThumbnailUrl } from "~/components/media/thumbnail-image";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

const BULK_RETRY_CONCURRENCY = 8;

export function JobsPage(props: { replaySince?: number }) {
	const jobsList = useJobsList(orpc.jobs);
	const jobsQuery = jobsList.query;
	const workspace = useWorkspaceNavigation();
	const inspection = useJobInspection(
		workspace.selectedJobId,
		jobsList.list,
		(id, signal) => orpc.jobs.get({ id }, { signal }),
		(jobId) => void workspace.open({ kind: "job", jobId }),
	);
	useWorkspaceView(() => ({
		kind: "jobs",
		job: inspection.job(),
		failed: inspection.failed(),
	}));
	const queryClient = useQueryClient();

	const replaySince = props.replaySince;
	useJobsQueryEvents((signal) =>
		orpc.jobs.events(replaySince === undefined ? undefined : { replaySince }, {
			signal,
		}),
	);

	return (
		<JobsScreen
			{...jobsList.screen}
			onUploadTarget={(sourceId, reservationId, filename, file) =>
				orpc.media.upload({ sourceId, reservationId, filename, file })
			}
			loadTargets={(id, offset, limit, signal) =>
				orpc.jobs.targets({ id, offset, limit }, { signal })
			}
			inspection={inspection}
			buildThumbnailUrl={buildThumbnailUrl}
			onRefresh={async () => {
				await jobsQuery.refetch();
			}}
			onRetry={async (jobId, replacementUploadId) => {
				try {
					await orpc.jobs.retry({ id: jobId, replacementUploadId });
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
						setTimeout(() => URL.revokeObjectURL(url), 1000);
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
		/>
	);
}
