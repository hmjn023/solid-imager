import { createCategoryService } from "@solid-imager/application/services/category-service";
import type { UpdateCategory } from "@solid-imager/core/domain/categories/schemas";
import type {
	Category,
	CategoryRepository,
} from "@solid-imager/core/domain/repositories/category-repository";
import { DrizzleCategoryRepository } from "~/infrastructure/repositories/category-repository";

// Initialize repository
const categoryRepo: CategoryRepository = new DrizzleCategoryRepository();
const categoryService = createCategoryService(categoryRepo);

const getCategoryByIdServer = async (
	id: string,
): Promise<Category | undefined> => {
	const result = await categoryService.get(id);
	return result ?? undefined;
};

const updateCategoryServer = async (
	id: string,
	data: UpdateCategory,
): Promise<Category> => await categoryService.update(id, data);

const deleteCategoryServer = async (id: string): Promise<{ success: true }> => {
	await categoryService.delete(id);
	return { success: true };
};

export const CategoryService = {
	list: categoryService.list,
	create: categoryService.create,
	get: getCategoryByIdServer,
	update: updateCategoryServer,
	delete: deleteCategoryServer,
};
