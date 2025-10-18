import { Pool } from "pg";
import { createDatabaseServiceLayer } from "~/infrastructure/db/layer";

// Create a test pool
const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a test database layer
export const TestDatabaseLive = createDatabaseServiceLayer(testPool);
