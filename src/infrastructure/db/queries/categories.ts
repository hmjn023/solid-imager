import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { categories, type NewCategory } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

/**
 * Selects all categories from the database.
 * @returns {Promise<Category[]>} A promise that resolves with an array of category objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
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

/**
 * Inserts a new category into the database.
 * @param {NewCategory} categoryData - The data for the new category.
 * @returns {Promise<Category[]>} A promise that resolves with an array containing the newly inserted category.
 * @throws {ConstraintError} If a category with the same name already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
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

/**
 * Selects a category by its ID from the database.
 * @param {string} categoryId - The ID of the category to select.
 * @returns {Promise<typeof categories.$inferSelect>} A promise that resolves with the category object.
 * @throws {NotFoundError} If no category with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectCategoryById = async (categoryId: string) => {
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

/**
 * Updates an existing category in the database.
 * @param {string} categoryId - The ID of the category to update.
 * @param {Partial<NewCategory>} categoryData - The partial data to update the category with.
 * @returns {Promise<typeof categories.$inferSelect>} A promise that resolves with the updated category object.
 * @throws {NotFoundError} If no category with the given ID is found.
 * @throws {ConstraintError} If the update causes a unique constraint violation (e.g., duplicate name).
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const updateCategory = async (
  categoryId: string,
  categoryData: Partial<NewCategory>
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

/**
 * Deletes a category from the database.
 * @param {string} categoryId - The ID of the category to delete.
 * @returns {Promise<typeof categories.$inferSelect>} A promise that resolves with the deleted category object.
 * @throws {NotFoundError} If no category with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteCategory = async (
  categoryId: string
): Promise<typeof categories.$inferSelect> => {
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
