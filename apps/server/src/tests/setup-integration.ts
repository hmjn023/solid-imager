import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, vi } from "vitest";

// Bootstrap
beforeAll(async () => {
  const { bootstrap } = await import("~/infrastructure/bootstrap");
  bootstrap();
});

config({ path: path.resolve(process.cwd(), ".env") });

process.env.DB_HOST = "pglite";
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "test";
}

// Mock the DB module for integration tests to use PGlite
vi.mock("~/infrastructure/db/index", async () => {
  const schema = await import("~/infrastructure/db/schema");
  const client = new PGlite();
  const testDb = drizzle(client, { schema });
  await migrate(testDb, { migrationsFolder: "./drizzle" });
  return { db: testDb };
});

beforeEach(() => {
  vi.clearAllMocks();
});
