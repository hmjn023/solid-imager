import type { MediaSearchResponse } from "@solid-imager/core/media";
import type {
	FetchNextPageOptions,
	InfiniteData,
	QueryClient,
	QueryKey,
} from "@tanstack/solid-query";
import { isServer } from "@solidjs/web";
import { createMemo, untrack } from "solid-js";
import { type QueryStateLike, toQueryUiState } from "../query-state";
import { createSynchronousState } from "../utils/synchronous-state";
import { createStableMediaResults } from "./stable-media-results";

type MediaQueryOptions = {
	queryKey: QueryKey;
	meta?: Record<string, unknown>;
};

type MediaQuery = Pick<
	QueryStateLike<never>,
	"error" | "status" | "fetchStatus"
> & {
	dataUpdatedAt: number;
	hasNextPage: boolean;
	isFetching: boolean;
	fetchNextPage: (options: FetchNextPageOptions) => Promise<unknown>;
};

export function createInfiniteMediaResults(
	client: QueryClient,
	options: () => MediaQueryOptions,
	query: MediaQuery,
	settings: { hasInitialData: () => boolean; isRestored: () => boolean },
) {
	const cached = (key: QueryKey) =>
		client.getQueryData<InfiniteData<MediaSearchResponse>>(key);
	const initial = untrack(() => {
		if (!settings.hasInitialData()) return;
		const key = options().queryKey;
		const data = cached(key);
		if (data) return { data, key: JSON.stringify(key) };
	});
	// The Query 6 data accessor participates in Solid transitions. Read committed
	// cache entries here so the grid can stay mounted through a query-key change.
	const rendered = createMemo((previous: typeof initial) => {
		if (isServer) return initial;
		const { queryKey, meta } = options();
		const status = query.status;
		void query.dataUpdatedAt;
		const data = cached(queryKey);
		if (data) {
			const key = JSON.stringify(queryKey);
			return previous?.data === data && previous.key === key
				? previous
				: { data, key };
		}
		if (meta?.preservePreviousResults === true && status !== "error")
			return previous;
	});

	const data = () => rendered()?.data;
	const results = createStableMediaResults(data);
	// Track the actual pagination command without reading the query's async
	// data projection on the first paint, when it has not settled yet.
	const nextPage = createSynchronousState(false);
	const fetchNextPage = async () => {
		if (!settings.isRestored() || nextPage.current() || !query.hasNextPage)
			return;
		nextPage.set(true);
		try {
			return await query.fetchNextPage({ cancelRefetch: false });
		} finally {
			nextPage.set(false);
		}
	};
	return {
		data,
		fetchNextPage,
		isFetchingNextPage: nextPage.read,
		results,
		current: () => rendered()?.key === JSON.stringify(options().queryKey),
		contentState: () => {
			const items = data() ? results() : undefined;
			const fetchStatus = query.fetchStatus;
			return toQueryUiState(
				{
					data: items,
					error: query.error,
					status: query.status,
					fetchStatus:
						fetchStatus === "idle" && items && query.isFetching
							? "fetching"
							: fetchStatus,
				},
				{ isEmpty: (items) => items.length === 0 },
			);
		},
	};
}
