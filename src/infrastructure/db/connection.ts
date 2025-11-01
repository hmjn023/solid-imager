import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import type { DatabaseConfig } from "~/config/database";

export type DbConnection = PGlite | postgres.Sql;

export async function createConnection(
  config: DatabaseConfig
): Promise<DbConnection> {
  if (config.databaseType === "pglite") {
    const pglite = new PGlite(config.pglite.path);
    // PGlite needs to be initialized. If inMemory is true, path is ignored.
    // For now, we'll assume path is provided if not inMemory.
    await pglite.waitReady;
    return pglite;
  }
  if (config.databaseType === "docker-compose-postgres") {
    const sql = postgres({
      host: config.dockerComposePostgres.host,
      port: config.dockerComposePostgres.port,
      username: config.dockerComposePostgres.user,
      password: config.dockerComposePostgres.password,
      database: config.dockerComposePostgres.database,
    });
    // Test connection
    await sql`SELECT 1`;
    return sql;
  }
  throw new Error("Unsupported database type.");
}

export async function closeConnection(connection: DbConnection): Promise<void> {
  if (connection instanceof PGlite) {
    await connection.close();
  } else if (typeof connection === "function" && "end" in connection) {
    await connection.end();
  }
}
