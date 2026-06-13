import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";
import type { getPersistence } from "~/infrastructure/db/persistence";

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
				queryKey: ["allProjects"],
				queryFn: () => client.projects.list(),
				queryClient,
				getKey: (project) => project.id,
			}),
		}),
	);
}
