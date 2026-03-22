import type {
	NewCategory,
	UpdateCategory,
} from "@solid-imager/core/domain/categories/schemas";
import {
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Category,
	CategoryRepository,
} from "@solid-imager/core/domain/repositories/category-repository";
import { eq } from "drizzle-orm";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import { categories } from "~/infrastructure/db/schema";

export class DrizzleCategoryRepository implements CategoryRepository {
	async findAll(): Promise<Category[]> {
		try {
			const results = await db.select().from(categories);
			return results as unknown as Category[];
		} catch (error) {
			throw new UnexpectedError("Failed to select categories", error);
		}
	}

	async findById(id: string, tx?: Transaction): Promise<Category | null> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client
				.select()
				.from(categories)
				.where(eq(categories.id, id));
			if (result.length === 0) {
				return null;
			}
			return result[0] as unknown as Category;
		} catch (error) {
			throw new UnexpectedError(
				`Failed to select category by ID: ${id}`,
				error,
			);
		}
	}

	async create(category: NewCategory, tx?: Transaction): Promise<Category> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
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
			throw new UnexpectedError("Failed to insert category", error);
		}
	}

	async update(
		id: string,
		category: UpdateCategory,
		tx?: Transaction,
	): Promise<Category> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client
				.update(categories)
				.set(category)
				.where(eq(categories.id, id))
				.returning();

			if (result.length === 0) {
				throw new ResourceNotFoundError("Category", id);
			}
			return result[0] as unknown as Category;
		} catch (error) {
			if (error instanceof ResourceNotFoundError) {
				throw error;
			}
			throw new UnexpectedError(
				`Failed to update category with ID: ${id}`,
				error,
			);
		}
	}

	async delete(id: string, tx?: Transaction): Promise<void> {
		try {
			const client = (tx as unknown as TransactionClient) || db;
			const result = await client
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
			throw new UnexpectedError(
				`Failed to delete category with ID: ${id}`,
				error,
			);
		}
	}
}
