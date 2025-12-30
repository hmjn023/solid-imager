import { eq } from "drizzle-orm";
import type { NewCategory, UpdateCategory } from "~/domain/categories/schemas";
import type { Transaction } from "~/domain/interfaces/transaction-manager";
import type {
  Category,
  CategoryRepository,
} from "~/domain/repositories/category-repository";
import { NotFoundError, UnknownDbError } from "~/infrastructure/db/errors";
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

  async findById(id: string, tx?: Transaction): Promise<Category | null> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
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

  async create(category: NewCategory, tx?: Transaction): Promise<Category> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
        .insert(categories)
        .values({
          ...category,
          description: category.description ?? "",
          color: category.color ?? "#808080",
        })
        .returning();
      return result[0] as unknown as Category;
    } catch (error: unknown) {
      throw new UnknownDbError({
        message: "Failed to insert category",
        details: error,
      });
    }
  }

  async update(
    id: string,
    category: UpdateCategory,
    tx?: Transaction
  ): Promise<Category> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
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

  async delete(id: string, tx?: Transaction): Promise<void> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
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
