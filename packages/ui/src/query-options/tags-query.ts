import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const tagsQueryKeys = {
	all: () => ["tags"] as const,
};

export const defaultTagsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildTagsQueryOptions(queryFn: () => Promise<TagResponse[]>) {
	return queryOptions({
		queryKey: tagsQueryKeys.all(),
		queryFn,
		...defaultTagsQueryConfig,
	});
}
