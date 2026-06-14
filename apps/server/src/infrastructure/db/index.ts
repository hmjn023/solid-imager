import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { SQL } from "bun";
import { drizzle as drizzleBunSql } from "drizzle-orm/bun-sql";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type BunSqlDb = ReturnType<typeof drizzleBunSql<typeof schema>>;
export type PgLiteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
export type DbInstance = BunSqlDb | PgLiteDb;

/**
 * Type representing either a database instance or a transaction client.
 * In Drizzle, both share the same common interface for queries.
 */
export type TransactionClient = BunSqlDb | PgLiteDb;

let _db: DbInstance | null = null;
let _queryClient: SQL | PGlite | null = null;

/**
 * Initializes and returns the Drizzle ORM database instance.
 * This function ensures that the database connection is established only once.
 * It reads database connection details from environment variables.
 * @returns {BunSqlDb | PgLiteDb} The initialized Drizzle ORM database instance.
 * @throws {Error} If required database environment variables are not set.
 */
function initializeDb() {
	if (_db) {
		return _db;
	}

	const dbHost = process.env.DB_HOST;
	const isTestEnv =
		process.env.NODE_ENV === "test" || process.env.VITEST === "true";

	console.log(
		`[DB] Initializing. Host: ${dbHost}, Env: ${process.env.NODE_ENV}`,
	);

	// テスト環境では必ずPGliteを使用
	if (isTestEnv || dbHost === "pglite") {
		const pglitePath =
			process.env.PGLITE_DATA_DIR ||
			path.join(process.cwd(), ".data", "pglite");
		console.log(
			`[DB] Using persistent PGlite at path: ${pglitePath} (Absolute: ${path.resolve(pglitePath)})`,
		);
		const client = new PGlite(pglitePath);
		_queryClient = client;
		_db = drizzlePglite(client, { schema });
		return _db;
	}

	const dbPort = process.env.DB_PORT || "5432";
	const dbName = process.env.DB_DATABASE || process.env.DB_NAME;
	const dbUser = process.env.DB_USER;
	const dbPassword = process.env.DB_PASSWORD;

	if (!(dbHost && dbName && dbUser && dbPassword)) {
		throw new Error(
			"Database environment variables are not set (DB_HOST, DB_DATABASE/DB_NAME, DB_USER, DB_PASSWORD)",
		);
	}

	const connectionString = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
	const client = new SQL(connectionString);
	_queryClient = client;
	_db = drizzleBunSql({ client, schema });
	return _db;
}

/**
 * A proxy object for the Drizzle ORM database instance.
 * It ensures that the database is initialized lazily upon first access.
 */
export const db = new Proxy({} as BunSqlDb | PgLiteDb, {
	get(_target, prop) {
		const instance = initializeDb();
		const value = instance[prop as keyof typeof instance];
		return typeof value === "function" ? value.bind(instance) : value;
	},
});
