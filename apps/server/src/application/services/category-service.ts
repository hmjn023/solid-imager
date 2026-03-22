import type {
	NewCategory,
	UpdateCategory,
} from "@solid-imager/core/domain/categories/schemas";
import type {
	Category,
	CategoryRepository,
} from "@solid-imager/core/domain/repositories/category-repository";
import { DrizzleCategoryRepository } from "~/infrastructure/repositories/category-repository";

// Initialize repository
const categoryRepo: CategoryRepository = new DrizzleCategoryRepository();

const getAllCategoriesServer = async (): Promise<Category[]> =>
	await categoryRepo.findAll();

const createCategoryServer = async (data: NewCategory): Promise<Category> =>
	await categoryRepo.create(data);

const getCategoryByIdServer = async (
	id: string,
): Promise<Category | undefined> => {
	const result = await categoryRepo.findById(id);
	return result ?? undefined;
};

const updateCategoryServer = async (
	id: string,
	data: UpdateCategory,
): Promise<Category> => await categoryRepo.update(id, data);

const deleteCategoryServer = async (id: string): Promise<{ success: true }> => {
	await categoryRepo.delete(id);
	return { success: true };
};

export const CategoryService = {
	getAllCategories: getAllCategoriesServer,
	createCategory: createCategoryServer,
	getCategoryDetails: getCategoryByIdServer,
	updateCategory: updateCategoryServer,
	deleteCategory: deleteCategoryServer,
};
