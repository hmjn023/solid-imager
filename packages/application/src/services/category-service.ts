import type { ICategoryService } from "../ports/category-service";
import type { Category, CategoryRepository } from "@solid-imager/core/domain/repositories/category-repository";
import type { NewCategory, UpdateCategory } from "@solid-imager/core/domain/categories/schemas";

export function createCategoryService(repo: CategoryRepository): ICategoryService {
  return {
    getAllCategories: () => repo.findAll(),
    createCategory: (data: NewCategory) => repo.create(data),
    getCategoryDetails: async (id: string) => {
      const result = await repo.findById(id);
      return result ?? undefined;
    },
    updateCategory: (id: string, data: UpdateCategory) => repo.update(id, data),
    deleteCategory: async (id: string) => {
      await repo.delete(id);
      return { success: true as const };
    },
  };
}
