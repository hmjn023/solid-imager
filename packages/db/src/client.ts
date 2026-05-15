import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";
import type { DbConfig, DbInstance } from "./types";

export function createDbClient(config: DbConfig): DbInstance {
	const isTestEnv =
		typeof process !== "undefined" &&
		(process.env.NODE_ENV === "test" || process.env.VITEST === "true");

	if (isTestEnv) {
		const pglitePath = path.join(process.cwd(), ".data", "pglite");
		const pgliteClient = new PGlite(pglitePath);
		return drizzlePglite(pgliteClient, { schema });
	}

	if (config.databaseType === "pglite") {
		const pglitePath =
			config.pglite.path ||
			path.join(process.cwd(), ".data", "pglite");
		const pgliteClient = new PGlite(pglitePath);
		return drizzlePglite(pgliteClient, { schema });
	}

	const { host, port, user, password, database } =
		config.dockerComposePostgres;
	const connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`;
	const pool = new Pool({ connectionString });
	return drizzleNodePostgres(pool, { schema });
}
