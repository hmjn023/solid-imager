import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { characters } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectCharacters = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(characters),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select characters",
              details: error,
            })
        )
      )
    );
  });

export const insertCharacter = (characterData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(characters).values(characterData).returning(),
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
              message: "Character with this name and IP already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert character",
            details: error,
          });
        })
      )
    );
  });

export const selectCharacterById = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(characters).where(eq(characters.id, characterId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select character by ID: ${characterId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Character with ID ${characterId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateCharacter = (characterId: number, characterData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(characters)
            .set(characterData)
            .where(eq(characters.id, characterId))
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
              message: "Character with this name and IP already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update character with ID: ${characterId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Character with ID ${characterId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteCharacter = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(characters)
            .where(eq(characters.id, characterId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete character with ID: ${characterId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Character with ID ${characterId} not found`,
          })
        )
      );
    }
    return result[0];
  });
