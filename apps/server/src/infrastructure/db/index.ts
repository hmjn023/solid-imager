import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { SQL } from "bun";
import { drizzle as drizzleBunSql } from "drizzle-orm/bun-sql";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { logger } from "~/infrastructure/logger";
import { createPglite } from "./pglite";
import { resolvePostgresDriver } from "./postgres-driver";
import * as schema from "./schema";

export type BunSqlDb = ReturnType<typeof drizzleBunSql<typeof schema>>;
export type NodePgDb = ReturnType<typeof drizzleNodePg<typeof schema>>;
export type PgLiteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
export type DbInstance = BunSqlDb | NodePgDb | PgLiteDb;

/**
 * Type representing either a database instance or a transaction client.
 * In Drizzle, both share the same common interface for queries.
 */
export type TransactionClient = BunSqlDb | NodePgDb | PgLiteDb;

let _db: DbInstance | null = null;
let _queryClient: SQL | Pool | PGlite | null = null;

type SharedDbState = {
	db: DbInstance;
	queryClient: SQL | Pool | PGlite;
};

const sharedDbGlobal = globalThis as typeof globalThis & {
	__SOLID_IMAGER_DB__?: SharedDbState;
};
const sharedDbProcess = process as typeof process & {
	__SOLID_IMAGER_DB__?: SharedDbState;
};

function getSharedDbState(): SharedDbState | undefined {
	return (
		sharedDbGlobal.__SOLID_IMAGER_DB__ ?? sharedDbProcess.__SOLID_IMAGER_DB__
	);
}

function setSharedDbState(state: SharedDbState): void {
	sharedDbGlobal.__SOLID_IMAGER_DB__ = state;
	sharedDbProcess.__SOLID_IMAGER_DB__ = state;
}

/**
 * Initializes and returns the Drizzle ORM database instance.
 * This function ensures that the database connection is established only once.
 * It reads database connection details from environment variables.
 * @returns {BunSqlDb | NodePgDb | PgLiteDb} The initialized Drizzle ORM database instance.
 * @throws {Error} If required database environment variables are not set.
 */
function initializeDb() {
	if (_db) {
		return _db;
	}

	const sharedDb = getSharedDbState();
	if (sharedDb) {
		_db = sharedDb.db;
		_queryClient = sharedDb.queryClient;
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
		const client = createPglite(pglitePath);
		_queryClient = client;
		_db = drizzlePglite(client, { schema });
		setSharedDbState({
			db: _db,
			queryClient: client,
		});
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

	const postgresDriver = resolvePostgresDriver();
	logger.info({ postgresDriver }, "[DB] Using PostgreSQL driver");

	let queryClient: SQL | Pool;
	let database: BunSqlDb | NodePgDb;
	if (postgresDriver === "bun-sql") {
		const client = new SQL({
			adapter: "postgres",
			hostname: dbHost,
			port: dbPort,
			username: dbUser,
			password: dbPassword,
			database: dbName,
		});
		queryClient = client;
		database = drizzleBunSql({ client, schema });
	} else {
		const client = new Pool({
			host: dbHost,
			port: Number(dbPort),
			user: dbUser,
			password: dbPassword,
			database: dbName,
		});
		queryClient = client;
		database = drizzleNodePg(client, { schema });
	}
	_queryClient = queryClient;
	_db = database;
	setSharedDbState({
		db: database,
		queryClient,
	});
	return database;
}

/**
 * A proxy object for the Drizzle ORM database instance.
 * It ensures that the database is initialized lazily upon first access.
 */
export const db = new Proxy({} as DbInstance, {
	get(_target, prop) {
		const instance = initializeDb();
		const value = instance[prop as keyof typeof instance];
		// Bun.SQL is itself a callable object and is exposed by Drizzle as the
		// own `$client` property. Bind prototype methods, but preserve callable
		// client properties so their `unsafe`, `begin`, and `close` methods stay
		// available to diagnostics and shutdown code.
		if (typeof value === "function" && !Object.hasOwn(instance, prop)) {
			return value.bind(instance);
		}
		return value;
	},
});
