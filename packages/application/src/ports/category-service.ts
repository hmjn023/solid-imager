import type {
	NewCategory,
	UpdateCategory,
} from "@solid-imager/core/domain/categories/schemas";
import type { Category } from "@solid-imager/core/domain/repositories/category-repository";

/** Manages categories and looks up category details. */
export interface ICategoryService {
	getAllCategories(): Promise<Category[]>;
	createCategory(data: NewCategory): Promise<Category>;
	getCategoryDetails(id: string): Promise<Category | undefined>;
	updateCategory(id: string, data: UpdateCategory): Promise<Category>;
	deleteCategory(id: string): Promise<{ success: true }>;
}
