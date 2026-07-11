import type { QueryClientConfig } from "@tanstack/solid-query";

export const QUERY_STALE_TIME_MS = 5_000;
export const QUERY_GC_TIME_MS = 5 * 60 * 1_000;
export const QUERY_RETRY_DELAY_BASE_MS = 1_000;
export const QUERY_RETRY_DELAY_CAP_MS = 5_000;

export function createAppQueryClientConfig(
	isTransientError: (error: unknown) => boolean,
): QueryClientConfig {
	return {
		defaultOptions: {
			queries: {
				gcTime: QUERY_GC_TIME_MS,
				networkMode: "online",
				refetchOnReconnect: true,
				refetchOnWindowFocus: false,
				retry: (failureCount, error) =>
					isTransientError(error) && failureCount < 2,
				retryDelay: (attemptIndex) =>
					Math.min(
						QUERY_RETRY_DELAY_BASE_MS * 2 ** attemptIndex,
						QUERY_RETRY_DELAY_CAP_MS,
					),
				staleTime: QUERY_STALE_TIME_MS,
			},
			mutations: {
				retry: false,
			},
		},
	};
}
