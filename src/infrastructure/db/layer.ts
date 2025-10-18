import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Context, Effect } from "effect";
import type { Pool } from "pg";

export type DatabaseService = {
  readonly _: unique symbol;
  readonly db: PostgresJsDatabase;
};

export const DatabaseService = Context.Tag<DatabaseService>();

export const createDatabaseServiceLayer = (pool: Pool) =>
  Effect.sync(() => {
    const db = drizzle(pool);
    return DatabaseService.of({ _: Context.Tag(), db });
  });
