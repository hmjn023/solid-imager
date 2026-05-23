import { createSqliteProxyDb } from "@solid-imager/db/sqlite/client";
import { migrateTauriDb } from "@solid-imager/db/sqlite/migrations";
import type { SqliteDb } from "@solid-imager/db/sqlite/client";

export type InitializeTauriDbOptions = {
	onStatus?: (message: string) => void;
};

export type TauriDb = SqliteDb;
export type TauriDbTransaction = Parameters<
	Parameters<TauriDb["transaction"]>[0]
>[0];
export type TauriDbExecutor = TauriDb | TauriDbTransaction;

let dbPromise: Promise<TauriDb> | null = null;

async function createTauriDb(
	options: InitializeTauriDbOptions = {},
): Promise<TauriDb> {
	options.onStatus?.("Opening the local database...");
	const db = await createSqliteProxyDb();

	options.onStatus?.("Running database migrations...");
	await migrateTauriDb(db);

	return db;
}

export async function initializeTauriDb(
	options: InitializeTauriDbOptions = {},
): Promise<TauriDb> {
	if (!dbPromise) {
		dbPromise = createTauriDb(options);
	}

	return await dbPromise;
}
