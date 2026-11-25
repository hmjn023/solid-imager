import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { relations, type DrizzleExecutor } from "@solid-imager/db";
import { SQL } from "bun";
import { drizzle as drizzleBunSql } from "drizzle-orm/bun-sql";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { logger } from "~/infrastructure/logger";
import { createPglite } from "./pglite";
import { readPostgresConfig } from "./postgres-config";
import { resolvePostgresDriver } from "./postgres-driver";

type QueryClient = SQL | Pool | PGlite;
type DbInstance = DrizzleExecutor & { readonly $client: QueryClient };

let _db: DbInstance | null = null;
let _queryClient: QueryClient | null = null;

type SharedDbState = {
	db: DbInstance;
	queryClient: QueryClient;
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

export function createBunSqlDatabase(client: SQL) {
	return drizzleBunSql({ client, relations, jit: true });
}

/**
 * Initializes and returns the Drizzle ORM database instance.
 * This function ensures that the database connection is established only once.
 * It reads database connection details from environment variables.
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

	const {
		host: dbHost,
		port: dbPort,
		database: dbName,
		user: dbUser,
		password: dbPassword,
	} = readPostgresConfig();
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
		_db = drizzlePglite({ client, relations });
		setSharedDbState({
			db: _db,
			queryClient: client,
		});
		return _db;
	}

	if (!(dbHost && dbName && dbUser && dbPassword)) {
		throw new Error(
			"Set DB_HOST, POSTGRES_DB, POSTGRES_USER, and POSTGRES_PASSWORD to connect to PostgreSQL",
		);
	}

	const postgresDriver = resolvePostgresDriver();
	logger.info({ postgresDriver }, "[DB] Using PostgreSQL driver");

	let queryClient: SQL | Pool;
	let database: DbInstance;
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
		database = createBunSqlDatabase(client);
	} else {
		const client = new Pool({
			host: dbHost,
			port: Number(dbPort),
			user: dbUser,
			password: dbPassword,
			database: dbName,
		});
		queryClient = client;
		database = drizzleNodePg({ client, relations });
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
