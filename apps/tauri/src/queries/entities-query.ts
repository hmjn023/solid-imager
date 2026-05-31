import { queryOptions } from "@tanstack/solid-query";
import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
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
