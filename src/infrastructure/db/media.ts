import { and, eq, like } from "drizzle-orm";
import { Effect } from "effect";
import { type Media, medias } from "~/infrastructure/db/schema";
import { UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const insertMedia = (
  newMedia: Omit<Media, "id" | "createdAt" | "modifiedAt" | "indexedAt">
) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.insert(medias).values(newMedia).returning()
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
        .from(medias)
        .where(and(eq(medias.sourceId, sourceId), eq(medias.filePath, filePath)))
    );
    return result;
  });

export const selectMediaById = (id: string) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.select().from(medias).where(eq(medias.id, id))
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
        .from(medias)
        .where(
          and(eq(medias.sourceId, sourceId), like(medias.filePath, searchPath))
        )
    );
    return result;
  });

export const updateMedia = (id: string, updatedMedia: Partial<Media>) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.update(medias).set(updatedMedia).where(eq(medias.id, id)).returning()
    );
    return result[0];
  });

export const deleteMedia = (id: string) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    const result = yield* Effect.promise(() =>
      db.delete(medias).where(eq(medias.id, id)).returning()
    );
    return result[0];
  });

export const selectMediaBySourceId = (sourceId: string) =>
  Effect.gen(function* () {
    const { db } = yield* DatabaseService;
    return yield* Effect.tryPromise({
      try: () => db.select().from(medias).where(eq(medias.sourceId, sourceId)),
      catch: (error) => error,
    }).pipe(
      Effect.mapError(
        (error) =>
          new UnknownDbError({
            message: `Failed to select medias by source ID: ${sourceId}`,
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
            message: `Failed to delete medias by path ${directoryPath} for source ID: ${sourceId}`,
            details: error,
          })
      )
    );
  });
