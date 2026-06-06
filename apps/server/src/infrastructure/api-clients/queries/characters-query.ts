import { queryOptions } from "@tanstack/solid-query";
import { fetchAllCharacters } from "../characters-api";

export const allCharactersQueryOptions = () =>
	queryOptions({
		queryKey: ["allCharacters"] as const,
		queryFn: fetchAllCharacters,
	});
