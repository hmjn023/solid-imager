import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteCategory,
  insertCategory,
  selectCategories,
  selectCategoryById,
  updateCategory,
} from "~/infrastructure/db/queries/categories";
import { categories, type NewCategory } from "~/infrastructure/db/schema";

describe("categories queries Integration", () => {
  let testCategoryId: number;

  beforeAll(async () => {
    // Clean up previous test data
    await db.delete(categories).where(sql`true`);

    // Seed initial data
    const initialCategory: NewCategory = {
      name: "Initial Category",
      description: "A category for testing",
    };
    const inserted = await db
      .insert(categories)
      .values(initialCategory)
      .returning();
    testCategoryId = inserted[0].id;
  });

  afterAll(async () => {
    // Clean up all data
    await db.delete(categories).where(sql`true`);
  });

  it("should select all categories", async () => {
    const result = await selectCategories();
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should select a category by its ID", async () => {
    const category = await selectCategoryById(testCategoryId);
    expect(category).toBeDefined();
    expect(category.id).toBe(testCategoryId);
    expect(category.name).toBe("Initial Category");
  });

  it("should throw NotFoundError when selecting a non-existent category", async () => {
    const nonExistentId = 999_999;
    await expect(selectCategoryById(nonExistentId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("should insert a new category", async () => {
    const newCategory: NewCategory = { name: "New Test Category" };
    const inserted = await insertCategory(newCategory);
    expect(inserted).toBeDefined();
    expect(inserted[0].name).toBe(newCategory.name);

    // Verify in DB
    const selected = await selectCategoryById(inserted[0].id);
    expect(selected).toBeDefined();

    // Cleanup
    await deleteCategory(inserted[0].id);
  });

  it("should update an existing category", async () => {
    const updatedName = "Updated Category Name";
    const updated = await updateCategory(testCategoryId, { name: updatedName });
    expect(updated).toBeDefined();
    expect(updated.name).toBe(updatedName);

    // Verify in DB
    const selected = await selectCategoryById(testCategoryId);
    expect(selected.name).toBe(updatedName);
  });

  it("should delete a category", async () => {
    const categoryToDelete: NewCategory = { name: "To Be Deleted" };
    const inserted = await insertCategory(categoryToDelete);
    const insertedId = inserted[0].id;

    await deleteCategory(insertedId);

    // Verify it's gone
    await expect(selectCategoryById(insertedId)).rejects.toThrow(NotFoundError);
  });
});
