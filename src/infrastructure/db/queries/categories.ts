import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { categories, type NewCategory } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

export const selectCategories = async () => {
  try {
    return await db.select().from(categories);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select categories",
      details: error,
    });
  }
};

export const insertCategory = async (categoryData: NewCategory) => {
  try {
    return await db.insert(categories).values(categoryData).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Category with this name already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to insert category",
      details: error,
    });
  }
};

export const selectCategoryById = async (categoryId: number) => {
  try {
    const result = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId));
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Category with ID ${categoryId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select category by ID: ${categoryId}`,
      details: error,
    });
  }
};

export const updateCategory = async (
  categoryId: number,
  categoryData: unknown
) => {
  try {
    const result = await db

      .update(categories)

      .set(categoryData)

      .where(eq(categories.id, categoryId))

      .returning();

    if (result.length === 0) {
      throw new NotFoundError({
        message: `Category with ID ${categoryId} not found`,
      });
    }

    return result[0];
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Category with this name already exists",

        details: error,
      });
    }

    throw new UnknownDbError({
      message: `Failed to update category with ID: ${categoryId}`,

      details: error,
    });
  }
};

export const deleteCategory = async (categoryId: number) => {
  try {
    const result = await db
      .delete(categories)
      .where(eq(categories.id, categoryId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Category with ID ${categoryId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete category with ID: ${categoryId}`,
      details: error,
    });
  }
};
