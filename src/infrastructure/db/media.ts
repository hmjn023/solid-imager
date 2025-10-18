import { and, eq, like } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseService } from "~/infrastructure/db/layer";
import { type Media, media } from "~/infrastructure/db/schema";
import { UnknownDbError } from "./errors";

export const insertMedia = (
  newMedia: Omit<Media, "id" | "createdAt" | "modifiedAt" | "indexedAt">
) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.insert(media).values(newMedia).returning()
    );
    return result[0];
  });

export const selectMediaBySourceIdAndFilePath = (
  sourceId: string,
  filePath: string
) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db
        .select()
        .from(media)
        .where(and(eq(media.sourceId, sourceId), eq(media.filePath, filePath)))
    );
    return result;
  });

export const selectMediaById = (id: string) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.select().from(media).where(eq(media.id, id))
    );
    return result;
  });

export const selectMediaBySourceIdAndDirectoryPath = (
  sourceId: string,
  directoryPath: string
) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const searchPath = `${directoryPath}%`;
    const result = yield* Effect.promise(() =>
      db
        .select()
        .from(media)
        .where(
          and(eq(media.sourceId, sourceId), like(media.filePath, searchPath))
        )
    );
    return result;
  });

export const updateMedia = (id: string, updatedMedia: Partial<Media>) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.update(media).set(updatedMedia).where(eq(media.id, id)).returning()
    );
    return result[0];
  });

export const deleteMedia = (id: string) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.delete(media).where(eq(media.id, id)).returning()
    );
    return result[0];
  });

export const selectMediaBySourceId = (sourceId: string) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    return yield* Effect.tryPromise({
      try: () => db.select().from(media).where(eq(media.sourceId, sourceId)),
      catch: (error) => error,
    }).pipe(
      Effect.mapError(
        (error) =>
          new UnknownDbError({
            message: `Failed to select media by source ID: ${sourceId}`,
            details: error,
          })
      )
    );
  });

export const deleteMediaByPath = (sourceId: string, directoryPath: string) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    return yield* Effect.tryPromise({
      try: () =>
        db
          .delete(media)
          .where(
            and(
              eq(media.sourceId, sourceId),
              like(media.filePath, `${directoryPath}%`)
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
    );
  });
