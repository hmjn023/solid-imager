import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import path from "path";
import fs from "fs";

export async function setup() {
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  console.log("Using PGlite data directory:", dataDir);

  // Clean up previous test run
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  // Ensure the data directory exists
  fs.mkdirSync(dataDir, { recursive: true });

  const client = new PGlite(dataDir);
  const db = drizzle(client);

  try {
    console.log("Starting migration...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("Database connection closed.");
  }
}

export async function teardown() {
  // Teardown logic here if needed
}

if (require.main === module) {
  setup();
}
