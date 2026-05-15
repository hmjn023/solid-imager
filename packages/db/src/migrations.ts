import { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export async function runPgliteMigrations(
	db: PgliteDatabase<Record<string, never>>,
	migrationsFolder: string,
): Promise<void> {
	const { migrate } = await import("drizzle-orm/pglite/migrator");
	await migrate(db, { migrationsFolder });
}

export async function createPgliteClient(
	dataDir: string,
): Promise<{ db: PgliteDatabase<Record<string, never>>; client: PGlite }> {
	const { drizzle } = await import("drizzle-orm/pglite");
	const client = new PGlite(dataDir);
	const db = drizzle(client);
	return { db, client };
}
