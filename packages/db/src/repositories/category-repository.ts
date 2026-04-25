import {
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { NewCategory, UpdateCategory } from "@solid-imager/core/domain/categories/schemas";
import type {
	Category,
	CategoryRepository,
} from "@solid-imager/core/domain/repositories/category-repository";
import { asc, eq } from "drizzle-orm";
import { categories } from "../schema";
import type { DrizzleExecutor } from "../types";

type DbCategory = typeof categories.$inferSelect;

export type CategoryRepositoryExecutorProvider = (
	tx?: unknown,
) => DrizzleExecutor;

type CreateCategoryRepositoryOptions = {
	orderByName?: boolean;
};

function mapToCategory(row: DbCategory): Category {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? null,
		color: row.color ?? null,
		parentId: row.parentId ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function createCategoryRepository(
	getExecutor: CategoryRepositoryExecutorProvider,
	options: CreateCategoryRepositoryOptions = {},
): CategoryRepository {
	return {
		async findAll(): Promise<Category[]> {
			try {
				const query = getExecutor().select().from(categories);
				const rows = await (options.orderByName
					? query.orderBy(asc(categories.name))
					: query);
				return rows.map((row) => mapToCategory(row));
			} catch (error) {
				throw new UnexpectedError("Failed to select categories", error);
			}
		},

		async findById(id: string, tx?: unknown): Promise<Category | null> {
			try {
				const rows = await getExecutor(tx)
					.select()
					.from(categories)
					.where(eq(categories.id, id))
					.limit(1);
				return rows[0] ? mapToCategory(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select category by ID: ${id}`,
					error,
				);
			}
		},

		async create(category: NewCategory, tx?: unknown): Promise<Category> {
			try {
				const rows = await getExecutor(tx)
					.insert(categories)
					.values({
						...category,
						description: category.description ?? "",
						color: category.color ?? "#808080",
					})
					.returning();
				return mapToCategory(rows[0]);
			} catch (error) {
				throw new UnexpectedError("Failed to insert category", error);
			}
		},

		async update(
			id: string,
			category: UpdateCategory,
			tx?: unknown,
		): Promise<Category> {
			try {
				const rows = await getExecutor(tx)
					.update(categories)
					.set(category)
					.where(eq(categories.id, id))
					.returning();

				if (rows.length === 0) {
					throw new ResourceNotFoundError("Category", id);
				}
				return mapToCategory(rows[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				throw new UnexpectedError(
					`Failed to update category with ID: ${id}`,
					error,
				);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			try {
				const rows = await getExecutor(tx)
					.delete(categories)
					.where(eq(categories.id, id))
					.returning();

				if (rows.length === 0) {
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
		},
	};
}
