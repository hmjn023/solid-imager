import { charactersQueryKeys } from "@solid-imager/ui/query-options";
import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import type { getPersistence } from "~/infrastructure/db/persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";

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
				queryKey: charactersQueryKeys.all(),
				queryFn: ({ signal }) => client.characters.list(undefined, { signal }),
				queryClient,
				getKey: (character) => character.id,
			}),
		}),
	);
}
