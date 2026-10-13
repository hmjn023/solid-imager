import "dotenv/config";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { count, eq } from "drizzle-orm";
import { createImportRequestRepository } from "@solid-imager/db/repositories/import-request-repository";
import * as schema from "@solid-imager/db/schema";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { createPglite } from "../src/infrastructure/db/pglite";
import { logger } from "../src/infrastructure/logger";

// No initServices: this maintenance command must never start workers while performing cutover.
const mode = process.argv[2] ?? "inspect";
if (!["inspect", "activate", "rollback"].includes(mode))
	throw new Error("Use inspect, activate or rollback");
if (mode !== "inspect" && !process.argv.includes("--writers-stopped"))
	throw new Error(
		"Stop/drain old and new import writers, then pass --writers-stopped",
	);

let database: DrizzleExecutor;
let close: () => Promise<void>;
if (process.env.DB_HOST === "pglite") {
	const client = createPglite(
		process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite"),
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
	// The core transaction port is opaque; only this command's own Drizzle transactions enter this boundary.
	const repo = createImportRequestRepository(
		(tx) => (tx ?? database) as DrizzleExecutor,
	);
	if (mode === "activate")
		logger.info(await repo.ensureCutover(), "Import request cutover complete");
	else if (mode === "rollback")
		logger.info(
			{ restored: await repo.rollback() },
			"Import request authority rolled back",
		);
	else {
		const control = await database.select().from(schema.importRequestCutovers);
		const counts = await database
			.select({ status: schema.importRequests.status, count: count() })
			.from(schema.importRequests)
			.groupBy(schema.importRequests.status);
		const [legacy] = await database
			.select({ count: count() })
			.from(schema.jobs)
			.where(eq(schema.jobs.type, "import_request"));
		logger.info(
			{ control, counts, legacyCount: legacy?.count ?? 0 },
			"Import request cutover inspection",
		);
	}
} finally {
	await close();
}
