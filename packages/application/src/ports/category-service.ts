import type {
	NewCategory,
	UpdateCategory,
	Category,
} from "@solid-imager/core/categories";

/** Manages categories and looks up category details. */
export interface ICategoryService {
	getAllCategories(): Promise<Category[]>;
	createCategory(data: NewCategory): Promise<Category>;
	getCategoryDetails(id: string): Promise<Category | undefined>;
	updateCategory(id: string, data: UpdateCategory): Promise<Category>;
	deleteCategory(id: string): Promise<{ success: true }>;
}
