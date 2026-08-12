import type { JobListResponse } from "@solid-imager/core/domain/jobs/schemas";
import { useJobEvents } from "@solid-imager/ui/hooks/use-job-events";
import { jobsQueryKeys } from "@solid-imager/ui/query-options";
import { toQueryUiState } from "@solid-imager/ui/query-state";
import { V2JobsScreen } from "@solid-imager/ui/screens/v2-jobs-screen";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { jobsQueryOptions } from "~/infrastructure/api-clients/queries";

export const Route = createFileRoute("/v2/jobs")({
	component: V2JobsRoute,
});

function V2JobsRoute() {
	const jobsQuery = createQuery<JobListResponse>(() => jobsQueryOptions());
	const queryClient = useQueryClient();

	useJobEvents(
		(signal) => orpc.jobs.events(undefined, { signal }),
		(event) => {
			if (event.event === "job-progress") {
				return;
			}
			void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
		},
	);

	return (
		<V2JobsScreen
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
			onDownload={async (job) => {
				if (!job.artifact) return;
				try {
					const stream = await orpc.jobs.downloadArtifact({ id: job.id });
					const blob = await new Response(stream).blob();
					const url = URL.createObjectURL(
						new Blob([blob], { type: job.artifact.contentType }),
					);
					const anchor = document.createElement("a");
					anchor.href = url;
					anchor.download = job.artifact.fileName;
					document.body.appendChild(anchor);
					anchor.click();
					anchor.remove();
					URL.revokeObjectURL(url);
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: "Failed to download artifact",
					);
					throw error;
				}
			}}
			state={() => toQueryUiState(jobsQuery)}
		/>
	);
}
