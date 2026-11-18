import type { TagResponse } from "@solid-imager/core/tags";
import type { QueryFunctionContext } from "@tanstack/solid-query";

export const tagsQueryKeys = {
	all: () => ["tags"] as const,
};

export const TAG_DICTIONARY_QUERY_KEY = ["tag-dictionary"] as const;
export const TAG_DICTIONARY_DETAIL_QUERY_KEY = [
	...TAG_DICTIONARY_QUERY_KEY,
	"detail",
] as const;

export const defaultTagsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildTagsQueryOptions(
	queryFn: (context: QueryFunctionContext) => Promise<TagResponse[]>,
) {
	return {
		queryKey: tagsQueryKeys.all(),
		queryFn,
		...defaultTagsQueryConfig,
	};
}
