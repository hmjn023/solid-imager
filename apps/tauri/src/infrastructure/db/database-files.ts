import { invoke } from "@tauri-apps/api/core";

const DATABASE_PREFIX = "solid-imager";

export function getDatabaseName(serverId: string | null | undefined): string {
	if (serverId === "default") {
		return "solid-imager.db";
	}
	const safeId = (serverId ?? "default").replace(/[^a-zA-Z0-9_-]/g, "_");
	return `${DATABASE_PREFIX}-${safeId}.db`;
}

export async function removeDatabaseFile(
	serverId: string | null | undefined,
): Promise<void> {
	await invoke("remove_sqlite_database", {
		databaseName: getDatabaseName(serverId),
	});
}
