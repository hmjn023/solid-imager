import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Effect } from "effect";
import { NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

type Media = {
  id: string;
  sourceId: string;
  createdAt: Date;
};

export const selectRandomMedia = (
  sourceId: string
): Effect.Effect<
  Media | undefined,
  UnknownDbError | NotFoundError,
  DatabaseService
> =>
  Effect.tryPromise({
    try: () => {
      // Placeholder implementation
      if (sourceId === "source1") {
        return { id: "media1", sourceId: "source1", createdAt: new Date() };
      }
      return;
    },
    catch: (error) => new UnknownDbError({ message: String(error) }),
  }).pipe(
    Effect.flatMap((media) =>
      media ? Effect.succeed(media) : Effect.fail(new NotFoundError())
    ),
    Effect.provideService(
      DatabaseService,
      DatabaseService.of({ _: DatabaseService(), db: {} as PostgresJsDatabase })
    )
  );
