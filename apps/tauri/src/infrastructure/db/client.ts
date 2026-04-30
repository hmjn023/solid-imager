import { PGlite } from "@electric-sql/pglite";
import { applyPgMigrations } from "@solid-imager/db/migrations";
import { drizzle } from "drizzle-orm/pglite";
import { loadServerMigrations } from "./migrations";
import * as schema from "./schema";

const TAURI_PGLITE_DATA_DIR = "idb://solid-imager-tauri";

export type InitializeTauriDbOptions = {
	onStatus?: (message: string) => void;
};

export type TauriDb = ReturnType<typeof drizzle<typeof schema>>;
export type TauriDbTransaction = Parameters<Parameters<TauriDb["transaction"]>[0]>[0];
export type TauriDbExecutor = TauriDb | TauriDbTransaction;

let dbPromise: Promise<TauriDb> | null = null;

async function createMigratedDb(dataDir: string): Promise<TauriDb> {
	const client = await PGlite.create({
		dataDir,
		relaxedDurability: true,
	});
	const db = drizzle(client, { schema });
	const migrations = await loadServerMigrations();

	await applyPgMigrations(db, migrations);

	return db;
}

async function createTauriDb(options: InitializeTauriDbOptions = {}): Promise<TauriDb> {
	options.onStatus?.("Opening the local database...");
	return await createMigratedDb(TAURI_PGLITE_DATA_DIR);
}

export async function initializeTauriDb(options: InitializeTauriDbOptions = {}): Promise<TauriDb> {
	if (!dbPromise) {
		dbPromise = createTauriDb(options);
	}

	return await dbPromise;
}
