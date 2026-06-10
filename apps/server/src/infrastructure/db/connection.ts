import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient } from "pg";
import type { DatabaseConfig } from "~/config/database";

export type DbConnection = PGlite | Pool | PoolClient;

export async function createConnection(
	config: DatabaseConfig,
): Promise<DbConnection> {
	if (config.databaseType === "pglite") {
		const pglite = new PGlite(config.pglite.path);
		await pglite.waitReady;
		return pglite;
	}
	if (config.databaseType === "docker-compose-postgres") {
		const pool = new Pool({
			host: config.dockerComposePostgres.host,
			port: config.dockerComposePostgres.port,
			user: config.dockerComposePostgres.user,
			password: config.dockerComposePostgres.password,
			database: config.dockerComposePostgres.database,
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
