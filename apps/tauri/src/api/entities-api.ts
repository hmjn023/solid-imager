import { client } from "~/orpc-client";

export function fetchAllProjects() {
	return client.projects.list();
}

export function fetchAllIps() {
	return client.ips.list();
}

export function fetchAllCharacters() {
	return client.characters.list();
}

export function fetchAllAuthors() {
	return client.authors.list();
}
