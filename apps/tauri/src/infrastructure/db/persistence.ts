import { createTauriSQLitePersistence } from "@tanstack/tauri-db-sqlite-persistence";
import Database from "@tauri-apps/plugin-sql";

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
	const rawDatabase = await Database.load("sqlite:solid-imager.db");
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
