import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema";
import { Effect, Layer, Context } from "effect";

export interface DatabaseService {
  readonly _: unique symbol;
  readonly db: ReturnType<typeof drizzle<typeof schema>>;
}

export const DatabaseService = Context.Tag<DatabaseService>();

export const createDatabaseServiceLayer = (pool: Pool) =>
  Layer.succeed(DatabaseService, {
    db: drizzle(pool, { schema }),
  });
