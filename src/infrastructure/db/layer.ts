import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Context, Effect, Layer } from "effect";
import type { Pool } from "pg";

export type DatabaseService = {
  readonly db: PostgresJsDatabase;
};

export const DatabaseService = {
  tag: Context.Tag<DatabaseService>(),
};

export const createDatabaseServiceLayer = (pool: Pool) =>
  Layer.effect(
    DatabaseService.Tag,
    Effect.sync(() => {
      const db = drizzle(pool);
      return { db };
    })
  );
