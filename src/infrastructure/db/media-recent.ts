import { desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { medias } from "~/infrastructure/db/schema";
import { UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectRecentMedia = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* DatabaseService;
    return yield* Effect.tryPromise({
      try: async () =>
        db
          .select()
          .from(medias)
          .where(eq(medias.sourceId, sourceId))
          .orderBy(desc(medias.createdAt))
          .limit(10),
      catch: (error) => error,
    }).pipe(
      Effect.mapError((error) => new UnknownDbError({ message: String(error) }))
    );
  });
