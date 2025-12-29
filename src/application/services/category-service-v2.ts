import { cache } from "@solidjs/router";
import type { NewCategory, UpdateCategory } from "~/domain/categories/schemas";
import type {
  Category,
  CategoryRepository,
} from "~/domain/repositories/category.repository";
import { DrizzleCategoryRepository } from "~/infrastructure/repositories/category-repository";

// Initialize repository
const categoryRepo: CategoryRepository = new DrizzleCategoryRepository();

const getAllCategoriesServer = cache(async (): Promise<Category[]> => {
  "use server";
  return await categoryRepo.findAll();
}, "getAllCategoriesV2");

const createCategoryServer = async (data: NewCategory): Promise<Category> => {
  "use server";
  return await categoryRepo.create(data);
};

const getCategoryByIdServer = cache(
  async (id: string): Promise<Category | undefined> => {
    "use server";
    const result = await categoryRepo.findById(id);
    return result ?? undefined;
  },
  "getCategoryByIdV2"
);

const updateCategoryServer = async (
  id: string,
  data: UpdateCategory
): Promise<Category> => {
  "use server";
  return await categoryRepo.update(id, data);
};

const deleteCategoryServer = async (id: string): Promise<{ success: true }> => {
  "use server";
  await categoryRepo.delete(id);
  return { success: true };
};

export const CategoryServiceV2 = {
  getAllCategories: getAllCategoriesServer,
  createCategory: createCategoryServer,
  getCategoryDetails: getCategoryByIdServer,
  updateCategory: updateCategoryServer,
  deleteCategory: deleteCategoryServer,
};
