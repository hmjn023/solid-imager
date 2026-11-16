import type { AppContractClient } from "@solid-imager/core/contract";
import type { JobListRequest } from "@solid-imager/core/jobs";
import { createInfiniteQuery, createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal } from "solid-js";
import {
	buildInfiniteJobsQueryOptions,
	flattenJobPages,
	jobsQueryKeys,
} from "../query-options/jobs-query";
import { toQueryUiState } from "../query-state";

/** Shared Web/Tauri list: server filters, matching totals, and independently cached pages. */
export function useJobsList(
	client: Pick<AppContractClient["jobs"], "list" | "types">,
) {
	const [status, setStatus] = createSignal<JobListRequest["status"]>();
	const [type, setType] = createSignal<string>();
	const query = createInfiniteQuery(() =>
		buildInfiniteJobsQueryOptions(
			{ status: status(), type: type() },
			(input, signal) => client.list(input, { signal }),
		),
	);
	const types = createQuery(() => ({
		queryKey: jobsQueryKeys.types(),
		queryFn: ({ signal }) => client.types(undefined, { signal }),
		staleTime: 30_000,
	}));
	const data = createMemo(() => flattenJobPages(query.data));
	const list = {
		get data() {
			return data();
		},
		get isPending() {
			return query.isPending;
		},
	};
	const loadMore = () => {
		if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
	};
	return {
		query,
		list,
		screen: {
			status,
			onStatusChange: setStatus,
			type,
			onTypeChange: setType,
			jobTypes: () => toQueryUiState(types),
			onRetryTypes: () => void types.refetch(),
			jobs: () => data()?.items ?? [],
			state: () =>
				toQueryUiState({
					data: data(),
					status: query.status,
					fetchStatus: query.fetchStatus,
					error: query.error,
				}),
			isRefreshing: () => query.isFetching && !query.isFetchingNextPage,
			hasMore: () => query.hasNextPage,
			isLoadingMore: () => query.isFetchingNextPage,
			loadMoreError: () => query.isFetchNextPageError,
			onLoadMore: loadMore,
		},
	};
}
