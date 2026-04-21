import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { createPresetRepository } from "@solid-imager/db/repositories/preset-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db";

export class DrizzlePresetRepository implements PresetRepository {
	private readonly repository = createPresetRepository(
		() => db as DrizzleExecutor,
	);

	list: PresetRepository["list"] = () => this.repository.list();

	get: PresetRepository["get"] = (id) => this.repository.get(id);

	getByName: PresetRepository["getByName"] = (name) =>
		this.repository.getByName(name);

	create: PresetRepository["create"] = (data) => this.repository.create(data);

	update: PresetRepository["update"] = (id, data) =>
		this.repository.update(id, data);

	delete: PresetRepository["delete"] = (id) => this.repository.delete(id);
}
