import type { Author } from "@solid-imager/core/authors";
import type { QueryFunctionContext } from "@tanstack/solid-query";

export const authorsQueryKeys = {
	all: () => ["allAuthors"] as const,
};

export const defaultAuthorsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildAuthorsQueryOptions(
	queryFn: (context: QueryFunctionContext) => Promise<Author[]>,
) {
	return {
		queryKey: authorsQueryKeys.all(),
		queryFn,
		...defaultAuthorsQueryConfig,
	};
}
