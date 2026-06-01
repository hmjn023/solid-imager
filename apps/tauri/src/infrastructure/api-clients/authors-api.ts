import { client } from "~/orpc-client";

export function fetchAllAuthors() {
	return client.authors.list();
}
