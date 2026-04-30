import type { Character } from "@solid-imager/core/domain/characters/schemas";
import { queryOptions } from "@tanstack/solid-query";

export const charactersQueryKeys = {
	all: () => ["allCharacters"] as const,
};

export const defaultCharactersQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildCharactersQueryOptions(
	queryFn: () => Promise<Character[]>,
) {
	return queryOptions({
		queryKey: charactersQueryKeys.all(),
		queryFn,
		...defaultCharactersQueryConfig,
	});
}
