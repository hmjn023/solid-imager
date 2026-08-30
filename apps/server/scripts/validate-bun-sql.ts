import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { sql } from "drizzle-orm";

const connectionString = process.env.BUN_SQL_TEST_DATABASE_URL;
if (!connectionString) {
	throw new Error(
		"BUN_SQL_TEST_DATABASE_URL is required (the smoke test never chooses a database implicitly)",
	);
}

const client = new SQL(connectionString, { connectionTimeout: 5 });
const database = drizzle({ client });

try {
	const rows = await database.execute<{ value: number }>(sql`SELECT 1 AS value`);
	if (rows[0]?.value !== 1) {
		throw new Error("Bun.SQL/Drizzle returned an unexpected SELECT 1 result");
	}

	const transactionRows = await database.transaction(async (tx) =>
		tx.execute<{ value: number }>(sql`SELECT 1 AS value`),
	);
	if (transactionRows[0]?.value !== 1) {
		throw new Error("Bun.SQL transaction returned an unexpected result");
	}

	process.stdout.write("Bun.SQL + Drizzle PostgreSQL smoke test OK\n");
} finally {
	await client.close();
}
