import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { categories, type NewCategory } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectCategories = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(categories),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select categories",
              details: error,
            })
        )
      )
    );
  });

export const insertCategory = (categoryData: NewCategory) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(categories).values(categoryData).returning(),
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
              message: "Category with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert category",
            details: error,
          });
        })
      )
    );
  });

export const selectCategoryById = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(categories).where(eq(categories.id, categoryId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select category by ID: ${categoryId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Category with ID ${categoryId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateCategory = (categoryId: number, categoryData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(categories)
            .set(categoryData)
            .where(eq(categories.id, categoryId))
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
              message: "Category with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update category with ID: ${categoryId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Category with ID ${categoryId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteCategory = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(categories)
            .where(eq(categories.id, categoryId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete category with ID: ${categoryId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Category with ID ${categoryId} not found`,
          })
        )
      );
    }
    return result[0];
  });
