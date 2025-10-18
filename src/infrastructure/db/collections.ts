import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { collectionMedia, collections } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectCollections = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(collections),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select collections",
              details: error,
            })
        )
      )
    );
  });

export const insertCollection = (collectionData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(collections).values(collectionData).returning(),
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
              message: "Collection with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert collection",
            details: error,
          });
        })
      )
    );
  });

export const selectCollectionById = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(collections).where(eq(collections.id, collectionId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select collection by ID: ${collectionId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Collection with ID ${collectionId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateCollection = (
  collectionId: string,
  collectionData: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(collections)
            .set(collectionData)
            .where(eq(collections.id, collectionId))
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
              message: "Collection with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update collection with ID: ${collectionId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Collection with ID ${collectionId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteCollection = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(collections)
            .where(eq(collections.id, collectionId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete collection with ID: ${collectionId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Collection with ID ${collectionId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const insertCollectionMedia = (
  collectionId: string,
  mediaId: string,
  displayOrder?: number
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .insert(collectionMedia)
            .values({ collectionId, mediaId, displayOrder })
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
              message: "Media already exists in this collection",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to insert media ${mediaId} into collection ${collectionId}`,
            details: error,
          });
        })
      )
    );
  });

export const deleteCollectionMedia = (collectionId: string, mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(collectionMedia)
            .where(
              and(
                eq(collectionMedia.collectionId, collectionId),
                eq(collectionMedia.mediaId, mediaId)
              )
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media ${mediaId} from collection ${collectionId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media ${mediaId} not found in collection ${collectionId}`,
          })
        )
      );
    }
    return result[0];
  });
