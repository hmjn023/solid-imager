import type { NewCategory, UpdateCategory } from "@solid-imager/core/domain/categories/schemas";
import { ResourceNotFoundError, UnexpectedError } from "@solid-imager/core/domain/errors";
import type {
  Category,
  CategoryRepository,
} from "@solid-imager/core/domain/repositories/category-repository";
import { eq } from "drizzle-orm";
import { categories } from "../schema";
import type { DrizzleExecutor } from "../types";

function mapCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createCategoryRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
): CategoryRepository {
  return {
    async findAll(): Promise<Category[]> {
      try {
        const results = await getExecutor().select().from(categories);
        return results.map(mapCategory);
      } catch (error) {
        throw new UnexpectedError("Failed to select categories", error);
      }
    },

    async findById(id: string, tx?: unknown): Promise<Category | null> {
      try {
        const result = await getExecutor(tx).select().from(categories).where(eq(categories.id, id));
        if (result.length === 0) {
          return null;
        }
        return mapCategory(result[0]);
      } catch (error) {
        throw new UnexpectedError(`Failed to select category by ID: ${id}`, error);
      }
    },

    async create(category: NewCategory, tx?: unknown): Promise<Category> {
      try {
        const result = await getExecutor(tx)
          .insert(categories)
          .values({
            name: category.name,
            description: category.description ?? "",
            color: category.color ?? "#808080",
            parentId: category.parentId ?? null,
          })
          .returning();
        return mapCategory(result[0]);
      } catch (error: unknown) {
        throw new UnexpectedError("Failed to insert category", error);
      }
    },

    async update(id: string, category: UpdateCategory, tx?: unknown): Promise<Category> {
      try {
        const updates: Partial<typeof categories.$inferInsert> = {};
        if (category.name !== undefined) updates.name = category.name;
        if (category.description !== undefined) updates.description = category.description;
        if (category.color !== undefined) updates.color = category.color;
        if (category.parentId !== undefined) updates.parentId = category.parentId;
        updates.updatedAt = new Date();

        const result = await getExecutor(tx)
          .update(categories)
          .set(updates)
          .where(eq(categories.id, id))
          .returning();

        if (result.length === 0) {
          throw new ResourceNotFoundError("Category", id);
        }
        return mapCategory(result[0]);
      } catch (error) {
        if (error instanceof ResourceNotFoundError) {
          throw error;
        }
        throw new UnexpectedError(`Failed to update category with ID: ${id}`, error);
      }
    },

    async delete(id: string, tx?: unknown): Promise<void> {
      try {
        const result = await getExecutor(tx)
          .delete(categories)
          .where(eq(categories.id, id))
          .returning();

        if (result.length === 0) {
          throw new ResourceNotFoundError("Category", id);
        }
      } catch (error) {
        if (error instanceof ResourceNotFoundError) {
          throw error;
        }
        throw new UnexpectedError(`Failed to delete category with ID: ${id}`, error);
      }
    },
  };
}
