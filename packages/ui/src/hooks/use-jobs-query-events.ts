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
	useJobEvents(openStream, (event) => {
		if (event.event === "job-progress")
			updateCachedJobProgress(client, event.data);
		else void refresh();
	});
}
