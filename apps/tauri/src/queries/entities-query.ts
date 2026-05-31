import { queryOptions } from "@tanstack/solid-query";
import {
	fetchAllAuthors,
	fetchAllCharacters,
	fetchAllIps,
	fetchAllProjects,
} from "~/api/entities-api";

export const allProjectsQueryOptions = () =>
	queryOptions({
		queryKey: ["allProjects"],
		queryFn: fetchAllProjects,
	});

export const allIpsQueryOptions = () =>
	queryOptions({
		queryKey: ["allIps"],
		queryFn: fetchAllIps,
	});

export const allCharactersQueryOptions = () =>
	queryOptions({
		queryKey: ["allCharacters"],
		queryFn: fetchAllCharacters,
	});

export const allAuthorsQueryOptions = () =>
	queryOptions({
		queryKey: ["allAuthors"],
		queryFn: fetchAllAuthors,
	});
