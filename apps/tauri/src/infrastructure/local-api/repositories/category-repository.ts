import { createCategoryRepository } from "@solid-imager/db/repositories/category-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export const TauriCategoryRepository = createCategoryRepository(getExecutor, {
	orderByName: true,
});
