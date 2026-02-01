import { os } from "@orpc/server";
import {
  newCategorySchema,
  updateCategorySchema,
} from "@solid-imager/core/domain/categories/schemas";
import { z } from "zod";
import { CategoryService } from "~/application/services/category-service";

/**
 * Categories Router Implementation
 */
export const categoriesRouter = {
  list: os.handler(() => CategoryService.getAllCategories()),

  get: os
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const category = await CategoryService.getCategoryDetails(input.id);
      if (!category) {
        throw new Error(`Category not found: ${input.id}`);
      }
      return category;
    }),

  create: os
    .input(newCategorySchema)
    .handler(({ input }) => CategoryService.createCategory(input)),

  update: os
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateCategorySchema,
      })
    )
    .handler(async ({ input }) => {
      const updated = await CategoryService.updateCategory(
        input.id,
        input.data
      );
      if (!updated) {
        throw new Error(`Category not found: ${input.id}`);
      }
      return updated;
    }),

  delete: os
    .input(z.object({ id: z.string().uuid() }))
    .handler(({ input }) => CategoryService.deleteCategory(input.id)),
};
