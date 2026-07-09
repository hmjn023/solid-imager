import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import type { getPersistence } from "~/infrastructure/db/persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";
import { collectionQueryKeys } from "./query-keys";

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
				queryKey: collectionQueryKeys.authors(),
				queryFn: ({ signal }) => client.authors.list(undefined, { signal }),
				queryClient,
				getKey: (author) => author.id,
			}),
		}),
	);
}
