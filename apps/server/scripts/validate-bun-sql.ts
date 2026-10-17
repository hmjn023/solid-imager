import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { sql } from "drizzle-orm";
import { jsonb, pgTable } from "drizzle-orm/pg-core";

const jsonProbe = pgTable("bun_sql_json_probe", {
	input: jsonb("input").notNull(),
});
const syncInput = {
	kind: "sync",
	sourcePath: "/isolated-probe",
	generation: 1,
};

const connectionString = process.env.BUN_SQL_TEST_DATABASE_URL;
if (!connectionString) {
	throw new Error(
		"BUN_SQL_TEST_DATABASE_URL is required (the smoke test never chooses a database implicitly)",
	);
}

const client = new SQL(connectionString, { connectionTimeout: 5 });
const database = drizzle({ client });

try {
	const rows = await database.execute<{ value: number }>(
		sql`SELECT 1 AS value`,
	);
	if (rows[0]?.value !== 1) {
		throw new Error("Bun.SQL/Drizzle returned an unexpected SELECT 1 result");
	}

	const transactionRows = await database.transaction(async (tx) =>
		tx.execute<{ value: number }>(sql`SELECT 1 AS value`),
	);
	if (transactionRows[0]?.value !== 1) {
		throw new Error("Bun.SQL transaction returned an unexpected result");
	}

	// A successful SELECT 1 does not prove that Drizzle's serialized JSONB
	// parameters survive Bun.SQL's parameter encoding. Exercise the SQL JSON
	// operators and constraints used by durable runs, in a session-local table.
	await database
		.transaction(async (tx) => {
			await tx.execute(sql`
			CREATE TEMP TABLE bun_sql_json_probe (
				input jsonb NOT NULL CHECK (
					jsonb_typeof(input) = 'object' AND input->>'kind' = 'sync'
				)
			) ON COMMIT DROP
		`);
			await tx.insert(jsonProbe).values({ input: syncInput });
			const result = await tx.execute<{
				inputType: string;
				kind: string;
				generation: number;
			}>(sql`
			SELECT jsonb_typeof(input) AS "inputType", input->>'kind' AS kind,
				(input->>'generation')::int AS generation FROM bun_sql_json_probe
		`);
			if (
				result[0]?.inputType !== "object" ||
				result[0]?.kind !== "sync" ||
				result[0]?.generation !== 1
			) {
				throw new Error(
					"Bun.SQL/Drizzle JSONB parameters did not preserve the input object",
				);
			}
		})
		.catch((cause) => {
			throw new Error(
				"Bun.SQL/Drizzle JSONB compatibility check failed. Use DB_POSTGRES_DRIVER=node-postgres with this runtime.",
				{ cause },
			);
		});

	process.stdout.write("Bun.SQL + Drizzle PostgreSQL smoke test OK\n");
} finally {
	await client.close();
}
