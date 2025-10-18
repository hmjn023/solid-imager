import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Effect } from "effect";
import { UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectRecentMedia = (_sourceId: string) =>
  Effect.tryPromise({
    try: () => {
      // Placeholder implementation
      return [];
    },
    catch: (error) => new UnknownDbError({ message: String(error) }),
  }).pipe(
    Effect.provideService(
      DatabaseService,
      DatabaseService.of({ _: DatabaseService(), db: {} as PostgresJsDatabase })
    )
  );
