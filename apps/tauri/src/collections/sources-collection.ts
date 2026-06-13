import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import type { getPersistence } from "~/infrastructure/db/persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";

type SourceResponse = Awaited<ReturnType<typeof client.sources.list>>[number];

export function createSourcesCollection(
	persistence: ReturnType<typeof getPersistence>,
) {
	return createCollection(
		persistedCollectionOptions<SourceResponse, string>({
			id: "sources",
			persistence,
			schemaVersion: 1,
			...queryCollectionOptions({
				queryKey: ["mediaSources"],
				queryFn: () => client.sources.list(),
				queryClient,
				getKey: (source) => source.id ?? source.name,
			}),
		}),
	);
}
