import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
	applyPgMigrations,
	type SharedPgliteDb,
} from "../../../../server/src/infrastructure/db/pglite-shared";
import * as schema from "../../../../server/src/infrastructure/db/schema";
import { loadServerMigrations } from "./migrations";

const TAURI_PGLITE_DATA_DIR = "idb://solid-imager-tauri";

export type TauriDb = SharedPgliteDb;

let dbPromise: Promise<TauriDb> | null = null;

async function createTauriDb(): Promise<TauriDb> {
	const client = await PGlite.create({
		dataDir: TAURI_PGLITE_DATA_DIR,
		relaxedDurability: true,
	});
	const db = drizzle(client, { schema });
	const migrations = await loadServerMigrations();

	await applyPgMigrations(db, migrations);

	return db;
}

export async function initializeTauriDb(): Promise<TauriDb> {
	if (!dbPromise) {
		dbPromise = createTauriDb();
	}

	return await dbPromise;
}
