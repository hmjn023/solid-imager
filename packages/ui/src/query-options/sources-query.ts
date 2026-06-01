import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const sourcesQueryKeys = {
	all: () => ["mediaSources"] as const,
};

export const defaultSourcesQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildSourcesQueryOptions(
	queryFn: () => Promise<SafeMediaSource[]>,
) {
	return queryOptions({
		queryKey: sourcesQueryKeys.all(),
		queryFn,
		...defaultSourcesQueryConfig,
	});
}
