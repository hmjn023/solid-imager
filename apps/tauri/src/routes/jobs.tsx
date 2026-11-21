import { t } from "@solid-imager/i18n";
import {
	useJobInspection,
	useJobsList,
	jobSelectionSearchSchema,
	useJobsQueryEvents,
} from "@solid-imager/ui/jobs";
import { downloadCompletedJobArtifact } from "@solid-imager/client";
import type { JobDto } from "@solid-imager/core/jobs";
import { jobsQueryKeys } from "@solid-imager/ui/query";
import { JobsScreen } from "@solid-imager/ui/screens/jobs";
import { toast } from "@solid-imager/ui/toast";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { buildThumbnailUrl } from "~/infrastructure/media/thumbnail-runtime";

const BULK_RETRY_CONCURRENCY = 8;

export const Route = createFileRoute("/jobs")({
	validateSearch: jobSelectionSearchSchema,
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
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		toast.success(
			t("manager.downloadedValue", { value0: String(job.artifact.fileName) }),
		);
	} catch (error) {
		toast.error(
			error instanceof Error
				? error.message
				: t("jobs.failedToDownloadArtifact"),
		);
		throw error;
	}
}

function JobsRoute() {
	const jobsList = useJobsList(orpc.jobs);
	const jobsQuery = jobsList.query;
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const inspection = useJobInspection(
		() => search().jobId,
		jobsList.list,
		(id, signal) => orpc.jobs.get({ id }, { signal }),
		(jobId) => void navigate({ search: { jobId } }),
	);
	const queryClient = useQueryClient();

	useJobsQueryEvents((signal) => orpc.jobs.events(undefined, { signal }));

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
			onDownload={downloadJobArtifact}
		/>
	);
}
