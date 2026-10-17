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

export function toQueryUiState<T>(
	query: QueryStateLike<T>,
	options: ToQueryUiStateOptions<T> = {},
): QueryUiState<T> {
	// Solid Query's data getter participates in Suspense, even when it returns
	// undefined. Manual loading UI must check status first or an initial read
	// can suspend the enclosing route transition and prevent query disposal.
	const data = query.status === "pending" ? undefined : query.data;
	const hasData = data !== undefined;
	const error = query.error ?? undefined;
	const fetchState: QueryUiFetchState =
		query.fetchStatus === "paused"
			? "paused"
			: query.fetchStatus === "fetching" && hasData
				? "background-fetching"
				: "idle";

	if (data !== undefined) {
		return {
			phase: options.isEmpty?.(data) ? "empty" : "data",
			fetchState,
			data,
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
