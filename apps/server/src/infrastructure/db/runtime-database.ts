import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool, type PoolClient } from "pg";
import type { DatabaseConfig } from "~/config/database";
import type { ExecutionRuntime } from "~/infrastructure/runtime/execution-runtime";
import * as schema from "./schema";

export type NodePostgresDb = ReturnType<
	typeof drizzleNodePostgres<typeof schema>
>;
export type PgLiteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
export type DbInstance = NodePostgresDb | PgLiteDb;
export type TransactionClient = NodePostgresDb | PgLiteDb;
export type DbConnection = PGlite | Pool | PoolClient;

type RuntimeEnv = NodeJS.ProcessEnv;

function resolvePglitePath(env: RuntimeEnv): string {
	return env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data", "pglite");
}

export function createPgliteStorage(
	runtime: ExecutionRuntime,
	env: RuntimeEnv = process.env,
): string | undefined {
	switch (runtime) {
		case "test":
			return resolvePglitePath(env);
		case "server":
			return resolvePglitePath(env);
		case "tauri":
			throw new Error("Tauri PGlite storage adapter is not wired yet.");
	}
}

export function createDatabase(
	runtime: ExecutionRuntime,
	env: RuntimeEnv = process.env,
): { db: DbInstance; queryClient: Pool | PGlite } {
	if (runtime === "test" || env.DB_HOST === "pglite") {
		const pgliteStorage = createPgliteStorage(runtime, env);
		const queryClient = new PGlite(pgliteStorage);
		const db = drizzlePglite(queryClient, { schema });
		return { db, queryClient };
	}

	if (runtime === "tauri") {
		const pgliteStorage = createPgliteStorage(runtime, env);
		const queryClient = new PGlite(pgliteStorage);
		const db = drizzlePglite(queryClient, { schema });
		return { db, queryClient };
	}

	const dbHost = env.DB_HOST;
	const dbPort = env.DB_PORT || "5432";
	const dbName = env.DB_DATABASE || env.DB_NAME;
	const dbUser = env.DB_USER;
	const dbPassword = env.DB_PASSWORD;

	if (!(dbHost && dbName && dbUser && dbPassword)) {
		throw new Error(
			"Database environment variables are not set (DB_HOST, DB_DATABASE/DB_NAME, DB_USER, DB_PASSWORD)",
		);
	}

	const connectionString = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
	const queryClient = new Pool({ connectionString });
	const db = drizzleNodePostgres(queryClient, { schema });
	return { db, queryClient };
}

export async function createConnectionFromConfig(
	config: DatabaseConfig,
): Promise<DbConnection> {
	if (config.databaseType === "pglite") {
		const queryClient = new PGlite(config.pglite.path);
		await queryClient.waitReady;
		return queryClient;
	}

	if (config.databaseType === "docker-compose-postgres") {
		const queryClient = new Pool({
			host: config.dockerComposePostgres.host,
			port: config.dockerComposePostgres.port,
			user: config.dockerComposePostgres.user,
			password: config.dockerComposePostgres.password,
			database: config.dockerComposePostgres.database,
		});
		const client = await queryClient.connect();
		await client.query("SELECT 1");
		client.release();
		return queryClient;
	}

	throw new Error("Unsupported database type.");
}

export async function closeDbConnection(
	connection: DbConnection,
): Promise<void> {
	if (connection instanceof PGlite) {
		await connection.close();
		return;
	}

	if (connection instanceof Pool) {
		await connection.end();
		return;
	}

	if (
		typeof connection === "object" &&
		connection !== null &&
		"release" in connection
	) {
		(connection as PoolClient).release();
	}
}
