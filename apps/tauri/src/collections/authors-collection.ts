import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import type { getPersistence } from "~/infrastructure/db/persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";

type AuthorResponse = Awaited<ReturnType<typeof client.authors.list>>[number];

export function createAuthorsCollection(
	persistence: ReturnType<typeof getPersistence>,
) {
	return createCollection(
		persistedCollectionOptions<AuthorResponse, string>({
			id: "authors",
			persistence,
			schemaVersion: 1,
			...queryCollectionOptions({
				queryKey: ["allAuthors"],
				queryFn: () => client.authors.list(),
				queryClient,
				getKey: (author) => author.id,
			}),
		}),
	);
}
