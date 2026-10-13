import "dotenv/config";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "@solid-imager/db/schema";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { createPglite } from "../src/infrastructure/db/pglite";

/** Maintenance owns a connection; initServices would start workers and violate quiescence. */
export async function withMaintenanceDatabase<T>(
	action: (db: DrizzleExecutor) => Promise<T>,
): Promise<T> {
	let database: DrizzleExecutor;
	let close: () => Promise<void>;
	if (process.env.DB_HOST === "pglite") {
		const client = createPglite(
			process.env.PGLITE_DATA_DIR ??
				path.join(process.cwd(), ".data", "pglite"),
		);
		database = drizzlePglite(client, { schema });
		close = () => client.close();
	} else {
		const { DB_HOST, DB_USER, DB_PASSWORD } = process.env;
		const name = process.env.DB_DATABASE ?? process.env.DB_NAME;
		if (!DB_HOST || !DB_USER || !DB_PASSWORD || !name)
			throw new Error("Database environment is incomplete");
		const client = new Pool({
			host: DB_HOST,
			port: Number(process.env.DB_PORT ?? 5432),
			user: DB_USER,
			password: DB_PASSWORD,
			database: name,
			max: 1,
		});
		database = drizzlePostgres(client, { schema });
		close = () => client.end();
	}
	try {
		return await action(database);
	} finally {
		await close();
	}
}
