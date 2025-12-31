import path from "node:path";
import { config } from "dotenv";
import { vi } from "vitest";

// Load .env
config({ path: path.resolve(process.cwd(), ".env") });

// Default test DB config if not set
if (!process.env.DB_HOST) {
  process.env.DB_HOST = "localhost"; // Logic in db/index.ts might check this, but we are mocking it.
  process.env.DB_PORT = "5432";
  process.env.DB_DATABASE = "solid_imager_test";
  process.env.DB_USER = "test";
  process.env.DB_PASSWORD = "test";
}

// Global DB Mock for Integration Tests
// This ensures every integration test gets an isolated in-memory PGlite instance
// without conflict with file-based PGlite or real Postgres.
vi.mock("~/infrastructure/db/index", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("~/infrastructure/db/schema");

  // Use in-memory PGlite for tests
  const client = new PGlite();
  const db = drizzle(client, { schema });

  // Expose the raw client globally for tests that need it (e.g. for access to the raw instance)
  // accessible via (global as any).__testDbClient
  // biome-ignore lint/suspicious/noExplicitAny: Global test client access
  (global as any).__testDbClient = client;

  return {
    db,
    // Helper to initialize if needed, though we return initialized db above
    initializeDb: () => db,
  };
});
