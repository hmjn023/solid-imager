import { desc, eq } from "drizzle-orm";
import { Effect, gen, service } from "effect";
import { medias } from "~/infrastructure/db/schema";
import { UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectRecentMedia = (sourceId: string) =>
  gen(function* (_) {
    const { db } = yield* _(service(DatabaseService.Tag));
    return yield* _(
      Effect.tryPromise({
        try: async () =>
          db
            .select()
            .from(medias)
            .where(eq(medias.sourceId, sourceId))
            .orderBy(desc(medias.createdAt))
            .limit(10),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) => new UnknownDbError({ message: String(error) })
        )
      )
    );
  });
