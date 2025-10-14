import { drizzle } from "drizzle-orm/node-postgres";
import { Context, Layer } from "effect";
import type { Pool } from "pg";
// biome-ignore lint/performance/noNamespaceImport: Drizzle ORM requires the entire schema object for its type-safe queries.
import * as schema from "./schema";

export type DatabaseService = {
  readonly _: unique symbol;
  readonly db: ReturnType<typeof drizzle<typeof schema>>;
};

export const DatabaseService = Context.Tag<DatabaseService>();

export const createDatabaseServiceLayer = (pool: Pool) =>
  Layer.succeed(DatabaseService, {
    db: drizzle(pool, { schema }),
  });
