import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import type { getPersistence } from "~/infrastructure/db/persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";

type TagResponse = Awaited<ReturnType<typeof client.tags.list>>[number];

export function createTagsCollection(
	persistence: ReturnType<typeof getPersistence>,
) {
	return createCollection(
		persistedCollectionOptions<TagResponse, string>({
			id: "tags",
			persistence,
			schemaVersion: 1,
			...queryCollectionOptions({
				queryKey: ["tags"],
				queryFn: () => client.tags.list(),
				queryClient,
				getKey: (tag) => tag.id,
			}),
		}),
	);
}
