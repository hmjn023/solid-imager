import type { CategoryRepository } from "@solid-imager/core/domain/repositories/category-repository";
import { createCategoryRepository } from "@solid-imager/db/repositories/category-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const DrizzleCategoryRepository: CategoryRepository =
	createCategoryRepository(getExecutor);
