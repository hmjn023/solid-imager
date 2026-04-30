import type { Author } from "@solid-imager/core/domain/authors/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const authorsQueryKeys = {
	all: () => ["allAuthors"] as const,
};

export const defaultAuthorsQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildAuthorsQueryOptions(queryFn: () => Promise<Author[]>) {
	return queryOptions({
		queryKey: authorsQueryKeys.all(),
		queryFn,
		...defaultAuthorsQueryConfig,
	});
}
