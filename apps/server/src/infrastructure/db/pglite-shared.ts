import { sql } from "drizzle-orm";
import type { MigrationMeta } from "drizzle-orm/migrator";
import type { drizzle } from "drizzle-orm/pglite";
import type * as schema from "./schema";

export type SharedPgliteDb = ReturnType<typeof drizzle<typeof schema>>;

export async function applyPgMigrations(
	db: SharedPgliteDb,
	migrations: MigrationMeta[],
) {
	await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
	await db.execute(sql`
		CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)
	`);

	const result = await db.execute<{
		id: number;
		hash: string;
		created_at: string | number | null;
	}>(
		sql`select id, hash, created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1`,
	);
	const lastMigration = result.rows[0];

	await db.transaction(async (tx) => {
		for (const migration of migrations) {
			if (
				lastMigration &&
				Number(lastMigration.created_at) >= migration.folderMillis
			) {
				continue;
			}

			for (const statement of migration.sql) {
				if (statement.trim().length === 0) {
					continue;
				}
				await tx.execute(sql.raw(statement));
			}

			await tx.execute(sql`
				insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
				values (${migration.hash}, ${migration.folderMillis})
			`);
		}
	});
}
