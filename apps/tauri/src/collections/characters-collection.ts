import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";
import type { getPersistence } from "~/infrastructure/db/persistence";

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
				queryKey: ["allCharacters"],
				queryFn: () => client.characters.list(),
				queryClient,
				getKey: (character) => character.id,
			}),
		}),
	);
}
