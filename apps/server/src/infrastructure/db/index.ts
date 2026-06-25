import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { logger } from "~/infrastructure/logger";
import * as schema from "./schema";

export type NodePgDb = ReturnType<typeof drizzleNodePg<typeof schema>>;
export type PgLiteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
export type DbInstance = NodePgDb | PgLiteDb;

/**
 * Type representing either a database instance or a transaction client.
 * In Drizzle, both share the same common interface for queries.
 */
export type TransactionClient = NodePgDb | PgLiteDb;

let _db: DbInstance | null = null;
let _queryClient: Pool | PGlite | null = null;

/**
 * Initializes and returns the Drizzle ORM database instance.
 * This function ensures that the database connection is established only once.
 * It reads database connection details from environment variables.
 * @returns {NodePgDb | PgLiteDb} The initialized Drizzle ORM database instance.
 * @throws {Error} If required database environment variables are not set.
 */
function initializeDb() {
	if (_db) {
		return _db;
	}

	const dbHost = process.env.DB_HOST;
	const isTestEnv =
		process.env.NODE_ENV === "test" || process.env.VITEST === "true";

	logger.info(
		{ dbHost, env: process.env.NODE_ENV },
		"[DB] Initializing database connection",
	);

	// テスト環境では必ずPGliteを使用
	if (isTestEnv || dbHost === "pglite") {
		const pglitePath =
			process.env.PGLITE_DATA_DIR ||
			path.join(process.cwd(), ".data", "pglite");
		logger.info(
			{ path: pglitePath, absolutePath: path.resolve(pglitePath) },
			"[DB] Using persistent PGlite database",
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
	const client = new Pool({ connectionString });
	_queryClient = client;
	_db = drizzleNodePg(client, { schema });
	return _db;
}

/**
 * A proxy object for the Drizzle ORM database instance.
 * It ensures that the database is initialized lazily upon first access.
 */
export const db = new Proxy({} as NodePgDb | PgLiteDb, {
	get(_target, prop) {
		const instance = initializeDb();
		const value = instance[prop as keyof typeof instance];
		return typeof value === "function" ? value.bind(instance) : value;
	},
});
