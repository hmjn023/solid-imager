import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema";

export type DatabaseService = {
  db: ReturnType<typeof drizzle<typeof schema>>;
};

export const createDatabaseService = (pool: Pool): DatabaseService => {
  const db = drizzle(pool, { schema });
  return { db };
};
