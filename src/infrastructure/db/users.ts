import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { users } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectUsers = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(users),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select users",
              details: error,
            })
        )
      )
    );
  });

export const insertUser = (userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(users).values(userData).returning(),
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
              message: "User with this email already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert user",
            details: error,
          });
        })
      )
    );
  });

export const selectUserById = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.select().from(users).where(eq(users.id, userId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select user by ID: ${userId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `User with ID ${userId} not found` })
        )
      );
    }
    return result[0];
  });

export const updateUser = (userId: string, userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(users)
            .set(userData)
            .where(eq(users.id, userId))
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
              message: "User with this email already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update user with ID: ${userId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `User with ID ${userId} not found` })
        )
      );
    }
    return result[0];
  });

export const deleteUser = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.delete(users).where(eq(users.id, userId)).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete user with ID: ${userId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `User with ID ${userId} not found` })
        )
      );
    }
    return result[0];
  });
