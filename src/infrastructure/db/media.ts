import { and, eq, like } from "drizzle-orm";
import { Effect } from "effect";
import { type Media, medias, type NewMedia } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectMediaById = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.select().from(medias).where(eq(medias.id, mediaId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `Media with ID ${mediaId} not found` })
        )
      );
    }
    return result[0];
  });

export const selectMediaBySourceIdAndFilePath = (
  sourceId: string,
  filePath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(medias)
            .where(
              and(eq(medias.sourceId, sourceId), eq(medias.filePath, filePath))
            ),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by source ID ${sourceId} and file path ${filePath}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media with source ID ${sourceId} and file path ${filePath} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const insertMedia = (media: NewMedia) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(medias).values(media).returning(),
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
              message: "Media with this source ID and file path already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert media",
            details: error,
          });
        })
      )
    );
  });

export const updateMedia = (mediaId: string, media: Media) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(medias)
            .set(media)
            .where(eq(medias.id, mediaId))
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
              message: "Media with this source ID and file path already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to update media",
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `Media with ID ${mediaId} not found` })
        )
      );
    }
    return result[0];
  });

export const deleteMedia = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.delete(medias).where(eq(medias.id, mediaId)).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media with ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `Media with ID ${mediaId} not found` })
        )
      );
    }
    return result[0];
  });

export const selectMediaBySourceIdAndDirectoryPath = (
  sourceId: string,
  directoryPath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(medias)
            .where(
              and(
                eq(medias.sourceId, sourceId),
                like(medias.filePath, `${directoryPath}%`)
              )
            ),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by source ID ${sourceId} and directory path ${directoryPath}`,
              details: error,
            })
        )
      )
    );
  });

export const selectMediaBySourceId = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(medias).where(eq(medias.sourceId, sourceId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const deleteMediaByPath = (sourceId: string, directoryPath: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(medias)
            .where(
              and(
                eq(medias.sourceId, sourceId),
                like(medias.filePath, `${directoryPath}%`)
              )
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media by path ${directoryPath} for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });
