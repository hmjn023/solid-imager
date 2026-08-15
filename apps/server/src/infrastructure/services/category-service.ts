import { createCategoryService } from "@solid-imager/application/services/category-service";
import { DrizzleCategoryRepository } from "~/infrastructure/repositories/category-repository";

export const CategoryService = createCategoryService(DrizzleCategoryRepository);
