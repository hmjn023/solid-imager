import { useQueryClient } from "@tanstack/solid-query";
import { onCleanup } from "solid-js";
import {
	jobsQueryKeys,
	updateCachedJobProgress,
} from "../query-options/jobs-query";
import { useJobEvents, type JobEventStreamFactory } from "./use-job-events";

// The stream replays terminal events on connection. Finish the current read, then
// fetch the latest state once for all events received while that read was pending.
/** Applies progress events to cached jobs and coalesces other events into query refreshes. */
export function useJobsQueryEvents(openStream: JobEventStreamFactory) {
	const client = useQueryClient();
	const key = { queryKey: jobsQueryKeys.all() };
	let disposed = false;
	let refreshing = false;
	let requested = false;
	onCleanup(() => {
		disposed = true;
	});
	async function refresh() {
		requested = true;
		if (refreshing) return;
		refreshing = true;
		try {
			await client.refetchQueries(
				{ ...key, type: "active", fetchStatus: "fetching" },
				{ cancelRefetch: false },
			);
			while (requested && !disposed) {
				requested = false;
				await client.invalidateQueries(key, { cancelRefetch: false });
			}
		} finally {
			refreshing = false;
		}
	}
	async function refreshDetail(jobId: string) {
		const detail = { queryKey: jobsQueryKeys.detail(jobId) };
		// Initial reads cannot be cancelled by invalidateQueries. Let them finish first.
		await client.refetchQueries(
			{ ...detail, type: "active", fetchStatus: "fetching" },
			{ cancelRefetch: false },
		);
		if (!disposed)
			await client.invalidateQueries(detail, { cancelRefetch: true });
	}
	useJobEvents(openStream, (event) => {
		if ("importBatchId" in event.data && event.data.importBatchId) {
			// Child jobs are hidden from the list. The parent publishes its own progress.
			if (event.data.jobId) void refreshDetail(event.data.jobId);
		} else if (event.event === "job-progress" && !event.data.created) {
			updateCachedJobProgress(client, event.data);
			if (event.data.jobId)
				void client.invalidateQueries(
					{ queryKey: jobsQueryKeys.targets(event.data.jobId) },
					{ cancelRefetch: false },
				);
		} else void refresh();
	});
}
