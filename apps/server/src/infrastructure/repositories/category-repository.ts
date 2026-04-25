import type { CategoryRepository } from "@solid-imager/core/domain/repositories/category-repository";
import { createCategoryRepository } from "@solid-imager/db/repositories/category-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export class DrizzleCategoryRepository implements CategoryRepository {
	private readonly repo: CategoryRepository;

	constructor() {
		this.repo = createCategoryRepository((tx) => (tx ?? db) as DrizzleExecutor);
	}

	findAll = () => this.repo.findAll();
	findById = (id: string, tx?: unknown) => this.repo.findById(id, tx);
	create = (
		category: Parameters<CategoryRepository["create"]>[0],
		tx?: unknown,
	) => this.repo.create(category, tx);
	update = (
		id: string,
		category: Parameters<CategoryRepository["update"]>[1],
		tx?: unknown,
	) => this.repo.update(id, category, tx);
	delete = (id: string, tx?: unknown) => this.repo.delete(id, tx);
}
