import type {
	NewCategory,
	UpdateCategory,
} from "@solid-imager/core/domain/categories/schemas";
import type {
	Category,
	CategoryRepository,
} from "@solid-imager/core/domain/repositories/category-repository";

export type CategoryService = ReturnType<typeof createCategoryService>;

export function createCategoryService(repository: CategoryRepository) {
	return {
		async list(): Promise<Category[]> {
			return await repository.findAll();
		},

		async get(id: string): Promise<Category | null> {
			return await repository.findById(id);
		},

		async create(input: NewCategory): Promise<Category> {
			return await repository.create(input);
		},

		async update(id: string, input: UpdateCategory): Promise<Category> {
			return await repository.update(id, input);
		},

		async delete(id: string): Promise<void> {
			await repository.delete(id);
		},
	};
}
