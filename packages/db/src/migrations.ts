import { PGlite } from "@electric-sql/pglite";
import type { PgLiteDb } from "./types";
import * as schema from "./schema";

export async function runPgliteMigrations(
	db: PgLiteDb,
	migrationsFolder: string,
): Promise<void> {
	const { migrate } = await import("drizzle-orm/pglite/migrator");
	await migrate(db, { migrationsFolder });
}

export async function createPgliteClient(
	dataDir: string,
): Promise<{ db: PgLiteDb; client: PGlite }> {
	const { drizzle } = await import("drizzle-orm/pglite");
	const client = new PGlite(dataDir);
	const db = drizzle(client, { schema });
	return { db, client };
}
