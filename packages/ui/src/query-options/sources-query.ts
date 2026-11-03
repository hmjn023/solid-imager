import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { QueryFunctionContext } from "@tanstack/solid-query";

export const sourcesQueryKeys = {
	all: () => ["mediaSources"] as const,
	detail: (sourceId: string) => ["mediaSources", sourceId] as const,
};

export const defaultSourcesQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildSourcesQueryOptions(
	queryFn: (context: QueryFunctionContext) => Promise<SafeMediaSource[]>,
) {
	return {
		queryKey: sourcesQueryKeys.all(),
		queryFn,
		...defaultSourcesQueryConfig,
	};
}
