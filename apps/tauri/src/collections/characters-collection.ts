import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import type { getPersistence } from "~/infrastructure/db/persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";
import { collectionQueryKeys } from "./query-keys";

type CharacterResponse = Awaited<
	ReturnType<typeof client.characters.list>
>[number];

export function createCharactersCollection(
	persistence: ReturnType<typeof getPersistence>,
) {
	return createCollection(
		persistedCollectionOptions<CharacterResponse, string>({
			id: "characters",
			persistence,
			schemaVersion: 1,
			...queryCollectionOptions({
				queryKey: collectionQueryKeys.characters(),
				queryFn: ({ signal }) => client.characters.list(undefined, { signal }),
				queryClient,
				getKey: (character) => character.id,
			}),
		}),
	);
}
