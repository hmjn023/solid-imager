import type { CategoryRepository } from "@solid-imager/core/domain/repositories/category-repository";
import { createCategoryRepository } from "@solid-imager/db/repositories/category-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export class DrizzleCategoryRepository implements CategoryRepository {
	private readonly _repo: CategoryRepository;

	constructor() {
		this._repo = createCategoryRepository(
			(tx) => (tx ?? db) as DrizzleExecutor,
		);
	}

	findAll = () => this._repo.findAll();
	findById = (id: string, tx?: unknown) => this._repo.findById(id, tx);
	create = (
		category: Parameters<CategoryRepository["create"]>[0],
		tx?: unknown,
	) => this._repo.create(category, tx);
	update = (
		id: string,
		category: Parameters<CategoryRepository["update"]>[1],
		tx?: unknown,
	) => this._repo.update(id, category, tx);
	delete = (id: string, tx?: unknown) => this._repo.delete(id, tx);
}
