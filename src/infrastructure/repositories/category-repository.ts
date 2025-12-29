import { eq } from "drizzle-orm";
import type { NewCategory, UpdateCategory } from "~/domain/categories/schemas";
import type {
  Category,
  CategoryRepository,
} from "~/domain/repositories/category.repository";
import {
  // ConstraintError,
  NotFoundError,
  UnknownDbError,
} from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index";
import { categories } from "~/infrastructure/db/schema";

export class DrizzleCategoryRepository implements CategoryRepository {
  async findAll(): Promise<Category[]> {
    try {
      const results = await db.select().from(categories);
      return results as unknown as Category[];
    } catch (error) {
      throw new UnknownDbError({
        message: "Failed to select categories",
        details: error,
      });
    }
  }

  async findById(id: string): Promise<Category | null> {
    try {
      const result = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id));
      if (result.length === 0) {
        return null;
      }
      return result[0] as unknown as Category;
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to select category by ID: ${id}`,
        details: error,
      });
    }
  }

  async create(category: NewCategory): Promise<Category> {
    try {
      // Drizzle expects possibly optional properties, schema allows optional
      // Map to db schema expected type if cleaner, or use unknown cast
      const result = await db
        .insert(categories)
        .values({
          ...category,
          // Defaults are handled by DB or need explicitness if missing from Zod
          description: category.description ?? "",
          color: category.color ?? "#808080",
        })
        .returning();
      return result[0] as unknown as Category;
    } catch (error: unknown) {
      // Categories don't enforce unique name in current schema explicitly shown,
      // but if they did we'd catch it. If parentId FK fails, also catchable.
      throw new UnknownDbError({
        message: "Failed to insert category",
        details: error,
      });
    }
  }

  async update(id: string, category: UpdateCategory): Promise<Category> {
    try {
      const result = await db
        .update(categories)
        .set(category)
        .where(eq(categories.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError({
          message: `Category with ID ${id} not found`,
        });
      }
      return result[0] as unknown as Category;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new UnknownDbError({
        message: `Failed to update category with ID: ${id}`,
        details: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError({
          message: `Category with ID ${id} not found`,
        });
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new UnknownDbError({
        message: `Failed to delete category with ID: ${id}`,
        details: error,
      });
    }
  }
}
