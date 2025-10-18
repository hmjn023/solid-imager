import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import {
  type Media,
  medias,
  mediaTags,
  type NewMediaTag,
} from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const bulkUpdateMedia = (
  sourceId: string,
  mediaIds: string[],
  updates: Partial<Media>
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(medias)
            .set(updates)
            .where(
              and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to bulk update media for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const bulkDeleteMedia = (sourceId: string, mediaIds: string[]) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(medias)
            .where(
              and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to bulk delete media for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const bulkUpdateMediaPaths = (
  sourceId: string,
  mediaIds: string[],
  pathUpdates: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const mediaToUpdate = await tx
              .select({ id: medias.id, fileName: medias.fileName })
              .from(medias)
              .where(
                and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
              );

            const updates = mediaToUpdate.map((media) => {
              const newFilePath = `${pathUpdates}/${media.fileName}`;
              return tx
                .update(medias)
                .set({ filePath: newFilePath })
                .where(eq(medias.id, media.id));
            });

            return Promise.all(updates);
          }),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to bulk update media paths for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const bulkAddMediaTags = (
  _sourceId: string,
  mediaIds: string[],
  tagsToAdd: number[]
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const values: NewMediaTag[] = [];
    for (const mediaId of mediaIds) {
      for (const tagId of tagsToAdd) {
        values.push({ mediaId, tagId });
      }
    }

    if (values.length === 0) {
      return yield* _(Effect.succeed([]));
    }

    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(mediaTags).values(values).returning(),
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
              message: "One or more media tags already exist",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to bulk add media tags",
            details: error,
          });
        })
      )
    );
  });

export const bulkRemoveMediaTags = (
  _sourceId: string,
  mediaIds: string[],
  tagsToRemove: number[]
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    if (mediaIds.length === 0 || tagsToRemove.length === 0) {
      return yield* _(Effect.succeed([]));
    }

    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(mediaTags)
            .where(
              and(
                inArray(mediaTags.mediaId, mediaIds),
                inArray(mediaTags.tagId, tagsToRemove)
              )
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to bulk remove media tags",
              details: error,
            })
        )
      )
    );
  });
