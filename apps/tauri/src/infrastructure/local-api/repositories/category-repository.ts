import { createCategoryRepository } from "@solid-imager/db/repositories/category-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriCategoryRepository = createCategoryRepository(getTauriDrizzleExecutor, {
	orderByName: true,
});
