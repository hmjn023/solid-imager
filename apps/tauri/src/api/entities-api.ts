import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import { client } from "~/orpc-client";

export function fetchAllProjects(): Promise<Project[]> {
	return client.projects.list() as unknown as Promise<Project[]>;
}

export function fetchAllIps(): Promise<Ip[]> {
	return client.ips.list() as unknown as Promise<Ip[]>;
}

export function fetchAllCharacters(): Promise<Character[]> {
	return client.characters.list() as unknown as Promise<Character[]>;
}

export function fetchAllAuthors(): Promise<Author[]> {
	return client.authors.list() as unknown as Promise<Author[]>;
}
