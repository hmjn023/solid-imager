import { createTauriSQLitePersistence } from "@tanstack/tauri-db-sqlite-persistence";
import Database from "@tauri-apps/plugin-sql";
import { getDatabaseName } from "./database-files";

/**
 * Tauri SQLプラグインはエラーをstringでrejectするが、
 * TanStack DBの isDuplicateColumnAddError() は instanceof Error をチェックしている。
 * このラッパーでstringエラーをErrorオブジェクトに変換する。
 */
function wrapDatabaseWithErrorNormalization(
	database: InstanceType<typeof Database>,
) {
	return {
		path: database.path,
		execute: async (query: string, bindValues?: unknown[]) => {
			try {
				return await database.execute(query, bindValues);
			} catch (e: unknown) {
				if (typeof e === "string") {
					throw new Error(e);
				}
				throw e;
			}
		},
		select: async <T>(query: string, bindValues?: unknown[]): Promise<T> => {
			try {
				return await database.select<T>(query, bindValues);
			} catch (e: unknown) {
				if (typeof e === "string") {
					throw new Error(e);
				}
				throw e;
			}
		},
		close: database.close?.bind(database),
	};
}

let persistenceInstance: ReturnType<
	typeof createTauriSQLitePersistence
> | null = null;
let rawDatabase: InstanceType<typeof Database> | null = null;

/**
 * Opens the per-server SQLite persistence once; close it before switching servers.
 *
 * @param serverId - Server cache identity used to choose the database file.
 * @returns The existing instance if already initialized, regardless of serverId.
 */
export async function initializePersistence(serverId?: string | null) {
	if (persistenceInstance) {
		return persistenceInstance;
	}
	const database = await Database.load(`sqlite:${getDatabaseName(serverId)}`);
	rawDatabase = database;
	const normalizedDatabase = wrapDatabaseWithErrorNormalization(database);
	persistenceInstance = createTauriSQLitePersistence({
		database: normalizedDatabase,
	});
	return persistenceInstance;
}

/** Clears the shared persistence instance and closes its underlying database. */
export async function closePersistence(): Promise<void> {
	const database = rawDatabase;
	rawDatabase = null;
	persistenceInstance = null;
	if (database?.close) {
		await database.close();
	}
}

/** Returns the initialized persistence instance, or throws if it has not been opened. */
export function getPersistence() {
	if (!persistenceInstance) {
		throw new Error(
			"Persistence not initialized. Call initializePersistence() first.",
		);
	}
	return persistenceInstance;
}
