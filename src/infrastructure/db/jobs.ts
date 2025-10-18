import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { jobs } from "~/infrastructure/db/schema";
import { UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectJobsBySourceId = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(jobs).where(eq(jobs.sourceId, sourceId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select jobs for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });
