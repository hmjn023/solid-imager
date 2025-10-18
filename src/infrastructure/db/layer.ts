import { drizzle } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer } from "effect";
import type { NodePostgresClient } from "../node-postgres-client";

export type DbService = {
  readonly db: NodePostgresClient;
};

export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  DbService
>() {}

export const createDatabaseServiceLayer = (pool: Pool) =>
  Layer.effect(
    DatabaseService.Tag,
    Effect.sync(() => {
      const db = drizzle(pool);
      return { db };
    })
  );
