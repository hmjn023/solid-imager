import { PGlite } from "@electric-sql/pglite";
import { SQL } from "bun";
import { Pool, type PoolClient } from "pg";
import type { DatabaseConfig } from "~/config/database";
import { createPglite } from "./pglite";
import { resolvePostgresDriver } from "./postgres-driver";

export type DbConnection = PGlite | SQL | Pool | PoolClient;

export async function createConnection(
	config: DatabaseConfig,
): Promise<DbConnection> {
	if (config.databaseType === "pglite") {
		const pglite = createPglite(config.pglite.path);
		await pglite.waitReady;
		return pglite;
	}
	if (config.databaseType === "docker-compose-postgres") {
		const postgres = config.dockerComposePostgres;
		if (resolvePostgresDriver() === "bun-sql") {
			const client = new SQL({
				adapter: "postgres",
				hostname: postgres.host,
				port: postgres.port,
				username: postgres.user,
				password: postgres.password,
				database: postgres.database,
			});
			// Test connection. The query is intentionally read-only.
			await client.unsafe("SELECT 1");
			return client;
		}

		const pool = new Pool({
			host: postgres.host,
			port: postgres.port,
			user: postgres.user,
			password: postgres.password,
			database: postgres.database,
		});
		// Test connection
		const client = await pool.connect();
		await client.query("SELECT 1");
		client.release();
		return pool;
	}
	throw new Error("Unsupported database type.");
}

export async function closeConnection(connection: DbConnection): Promise<void> {
	if (connection instanceof PGlite) {
		await connection.close();
	} else if (connection instanceof SQL) {
		await connection.close();
	} else if (connection instanceof Pool) {
		await connection.end();
	} else if (
		typeof connection === "object" &&
		connection !== null &&
		"release" in connection &&
		typeof connection.release === "function"
	) {
		connection.release();
	}
}
