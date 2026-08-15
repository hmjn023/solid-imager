import { implement } from "@orpc/server";
import { categoriesContract } from "@solid-imager/core/domain/contract/categories.contract";
import { CategoryService } from "~/infrastructure/services/category-service";

/**
 * Categories Router Implementation
 */
const os = implement(categoriesContract);

export const categoriesRouter = os.router({
	list: os.list.handler(() => CategoryService.getAllCategories()),

	get: os.get.handler(async ({ input }) => {
		const category = await CategoryService.getCategoryDetails(input.id);
		if (!category) {
			throw new Error(`Category not found: ${input.id}`);
		}
		return category;
	}),

	create: os.create.handler(({ input }) =>
		CategoryService.createCategory(input),
	),

	update: os.update.handler(async ({ input }) => {
		const updated = await CategoryService.updateCategory(input.id, input.data);
		if (!updated) {
			throw new Error(`Category not found: ${input.id}`);
		}
		return updated;
	}),

	delete: os.delete.handler(({ input }) =>
		CategoryService.deleteCategory(input.id),
	),
});
