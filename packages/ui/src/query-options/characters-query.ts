import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { QueryFunctionContext } from "@tanstack/solid-query";

export const charactersQueryKeys = {
	all: () => ["allCharacters"] as const,
};

export const defaultCharactersQueryConfig = {
	staleTime: 1000 * 60 * 5,
};

export function buildCharactersQueryOptions(
	queryFn: (context: QueryFunctionContext) => Promise<Character[]>,
) {
	return {
		queryKey: charactersQueryKeys.all(),
		queryFn,
		...defaultCharactersQueryConfig,
	};
}
