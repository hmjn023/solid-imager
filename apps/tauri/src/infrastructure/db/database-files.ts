import { invoke } from "@tauri-apps/api/core";

const DATABASE_PREFIX = "solid-imager";

/** Maps a server ID to a filesystem-safe SQLite name; the literal default ID uses the legacy name. */
export function getDatabaseName(serverId: string | null | undefined): string {
	if (serverId === "default") {
		return "solid-imager.db";
	}
	const safeId = (serverId ?? "default").replace(/[^a-zA-Z0-9_-]/g, "_");
	return `${DATABASE_PREFIX}-${safeId}.db`;
}

/** Requests deletion of the SQLite database belonging to the supplied server ID. */
export async function removeDatabaseFile(
	serverId: string | null | undefined,
): Promise<void> {
	await invoke("remove_sqlite_database", {
		databaseName: getDatabaseName(serverId),
	});
}
