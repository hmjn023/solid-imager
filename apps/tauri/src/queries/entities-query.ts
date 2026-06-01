import { queryOptions } from "@tanstack/solid-query";
import {
	fetchAllAuthors,
	fetchAllCharacters,
	fetchAllIps,
	fetchAllProjects,
} from "~/api/entities-api";

export const allProjectsQueryOptions = () =>
	queryOptions({
		queryKey: ["allProjects"] as const,
		queryFn: fetchAllProjects,
	});

export const allIpsQueryOptions = () =>
	queryOptions({
		queryKey: ["allIps"] as const,
		queryFn: fetchAllIps,
	});

export const allCharactersQueryOptions = () =>
	queryOptions({
		queryKey: ["allCharacters"] as const,
		queryFn: fetchAllCharacters,
	});

export const allAuthorsQueryOptions = () =>
	queryOptions({
		queryKey: ["allAuthors"] as const,
		queryFn: fetchAllAuthors,
	});
