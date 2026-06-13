import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { persistedCollectionOptions } from "@tanstack/tauri-db-sqlite-persistence";
import { client } from "~/orpc-client";
import { queryClient } from "~/router";
import type { getPersistence } from "~/infrastructure/db/persistence";

type IpResponse = Awaited<ReturnType<typeof client.ips.list>>[number];

export function createIpsCollection(
	persistence: ReturnType<typeof getPersistence>,
) {
	return createCollection(
		persistedCollectionOptions<IpResponse, string>({
			id: "ips",
			persistence,
			schemaVersion: 1,
			...queryCollectionOptions({
				queryKey: ["allIps"],
				queryFn: () => client.ips.list(),
				queryClient,
				getKey: (ip) => ip.id,
			}),
		}),
	);
}
