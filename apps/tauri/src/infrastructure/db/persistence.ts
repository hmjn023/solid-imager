import { createTauriSQLitePersistence } from "@tanstack/tauri-db-sqlite-persistence";
import Database from "@tauri-apps/plugin-sql";
import { getActiveServer } from "~/infrastructure/settings/server-settings";

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

export async function initializePersistence() {
	if (persistenceInstance) {
		return persistenceInstance;
	}
	const activeServer = getActiveServer();
	const databaseName =
		activeServer?.id === "default"
			? "solid-imager.db"
			: `solid-imager-${(activeServer?.id ?? "default").replace(
					/[^a-zA-Z0-9_-]/g,
					"_",
				)}.db`;
	const rawDatabase = await Database.load(`sqlite:${databaseName}`);
	const database = wrapDatabaseWithErrorNormalization(rawDatabase);
	persistenceInstance = createTauriSQLitePersistence({ database });
	return persistenceInstance;
}

export function getPersistence() {
	if (!persistenceInstance) {
		throw new Error(
			"Persistence not initialized. Call initializePersistence() first.",
		);
	}
	return persistenceInstance;
}
