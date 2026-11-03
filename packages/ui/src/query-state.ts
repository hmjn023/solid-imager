export type QueryUiPhase = "pending" | "data" | "empty" | "error" | "offline";

export type QueryUiFetchState = "idle" | "background-fetching" | "paused";

export type QueryUiState<T> = {
	phase: QueryUiPhase;
	fetchState: QueryUiFetchState;
	data: T | undefined;
	error: unknown;
};

export type QueryStateLike<T> = {
	data: T | undefined;
	error?: unknown;
	status: "pending" | "error" | "success";
	fetchStatus: "idle" | "fetching" | "paused";
};

export type ToQueryUiStateOptions<T> = {
	isEmpty?: (data: T) => boolean;
	isOnline?: boolean;
};

/**
 * Maps query status to presentation state. Existing data remains visible during
 * background fetches and errors; paused queries without data are offline.
 *
 * @param query - Query data and status to classify.
 * @param options - Optional empty-data predicate and online status override.
 * @returns Display phase, fetch state, data, and any retained error.
 */
export function toQueryUiState<T>(
	query: QueryStateLike<T>,
	options: ToQueryUiStateOptions<T> = {},
): QueryUiState<T> {
	const hasData = query.data !== undefined;
	const error = query.error ?? undefined;
	const fetchState: QueryUiFetchState =
		query.fetchStatus === "paused"
			? "paused"
			: query.fetchStatus === "fetching" && hasData
				? "background-fetching"
				: "idle";

	if (query.data !== undefined) {
		return {
			phase: options.isEmpty?.(query.data) ? "empty" : "data",
			fetchState,
			data: query.data,
			error,
		};
	}

	const offline = query.fetchStatus === "paused" || options.isOnline === false;

	return {
		phase: offline ? "offline" : query.status === "error" ? "error" : "pending",
		fetchState,
		data: undefined,
		error,
	};
}
