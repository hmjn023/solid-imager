import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { mediaGenerationInfo } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectMediaGenerationInfoById = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(mediaGenerationInfo)
            .where(eq(mediaGenerationInfo.mediaId, mediaId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media generation info by media ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media generation info for media ID ${mediaId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateMediaGenerationInfo = (mediaId: string, metadata: object) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(mediaGenerationInfo)
            .set({ metadata })
            .where(eq(mediaGenerationInfo.mediaId, mediaId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to update media generation info for media ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media generation info for media ID ${mediaId} not found`,
          })
        )
      );
    }
    return result[0];
  });
