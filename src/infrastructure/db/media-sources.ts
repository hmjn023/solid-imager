import { eq } from "drizzle-orm";
import { Effect } from "effect";
import {
  type MediaSource,
  mediaSources,
  type NewMediaSource,
} from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectMediaSources = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(mediaSources),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select media sources",
              details: error,
            })
        )
      )
    );
  });

export const selectMediaSourceById = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(mediaSources)
            .where(eq(mediaSources.id, mediaSourceId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media source by ID: ${mediaSourceId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media source with ID ${mediaSourceId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const insertMediaSource = (mediaSource: NewMediaSource) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(mediaSources).values(mediaSource).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Media source with this name or ID already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert media source",
            details: error,
          });
        })
      )
    );
  });

export const updateMediaSource = (
  mediaSourceId: string,
  mediaSource: MediaSource
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(mediaSources)
            .set(mediaSource)
            .where(eq(mediaSources.id, mediaSourceId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Media source with this name or ID already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to update media source",
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media source with ID ${mediaSourceId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteMediaSource = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(mediaSources)
            .where(eq(mediaSources.id, mediaSourceId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media source with ID: ${mediaSourceId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media source with ID ${mediaSourceId} not found`,
          })
        )
      );
    }
    return result[0];
  });
