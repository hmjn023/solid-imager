import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { medias } from "~/infrastructure/db/schema";
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
  Effect.gen(function* (_) {
    const { db } = yield* _(service(DatabaseService.Tag));
    const result = yield* _(
      Effect.tryPromise({
        try: async () =>
          db
            .select()
            .from(medias)
            .where(sql`${medias.sourceId} = ${sourceId}`)
            .orderBy(sql`RANDOM()`)
            .limit(1),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) => new UnknownDbError({ message: String(error) })
        )
      )
    );

    if (result.length === 0) {
      return yield* _(Effect.fail(new NotFoundError()));
    }
    return result[0];
  });
