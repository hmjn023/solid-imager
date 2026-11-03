import { createCategoryService } from "@solid-imager/application/categories";
import { DrizzleCategoryRepository } from "~/infrastructure/db/repositories";

export const CategoryService = createCategoryService(DrizzleCategoryRepository);
