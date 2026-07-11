import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import type { getPersistence } from "~/infrastructure/db/persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";
import { collectionQueryKeys } from "./query-keys";

type ProjectResponse = Awaited<ReturnType<typeof client.projects.list>>[number];

export function createProjectsCollection(
	persistence: ReturnType<typeof getPersistence>,
) {
	return createCollection(
		persistedCollectionOptions<ProjectResponse, string>({
			id: "projects",
			persistence,
			schemaVersion: 1,
			...queryCollectionOptions({
				queryKey: collectionQueryKeys.projects(),
				queryFn: ({ signal }) => client.projects.list(undefined, { signal }),
				queryClient,
				getKey: (project) => project.id,
			}),
		}),
	);
}
