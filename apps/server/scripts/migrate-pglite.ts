import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createPglite } from "../src/infrastructure/db/pglite";

async function main(): Promise<void> {
	const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
	console.log("Using PGlite data directory:", dataDir);

	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}

	const client = createPglite(dataDir);
	const db = drizzle(client);

	try {
		console.log("Starting migration...");
		await migrate(db, { migrationsFolder: "./drizzle" });
		console.log("Migration completed successfully.");
	} catch (error) {
		console.error("Migration failed:", error);
		process.exitCode = 1;
	} finally {
		await client.close();
		console.log("Database connection closed.");
	}
}

await main();
