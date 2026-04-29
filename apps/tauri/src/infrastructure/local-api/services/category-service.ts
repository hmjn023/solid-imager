import { createCategoryService } from "@solid-imager/application/services/category-service";
import type {
	Category,
	NewCategory,
	UpdateCategory,
} from "@solid-imager/core/domain/categories/schemas";
import { TauriCategoryRepository } from "../repositories/category-repository";

const categoryService = createCategoryService(TauriCategoryRepository);

export const TauriCategoryService = {
	async list(): Promise<Category[]> {
		return await categoryService.list();
	},

	async get(id: string): Promise<Category | null> {
		return await categoryService.get(id);
	},

	async create(input: NewCategory): Promise<Category> {
		return await categoryService.create(input);
	},

	async update(id: string, input: UpdateCategory): Promise<Category> {
		return await categoryService.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await categoryService.delete(id);
	},
};
