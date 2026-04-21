import { createPresetService } from "@solid-imager/application/services/preset-service";
import type {
	CreatePresetRequest,
	Preset,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { DrizzlePresetRepository } from "~/infrastructure/repositories/preset-repository";

let repository: PresetRepository = new DrizzlePresetRepository();
let service = createPresetService(repository);

// For testing IDI (dependency injection)
export const setPresetRepository = (repo: PresetRepository) => {
	repository = repo;
	service = createPresetService(repository);
};

export const PresetService = {
	async list(): Promise<Preset[]> {
		return await service.list();
	},

	async get(id: number): Promise<Preset> {
		return await service.get(id);
	},

	async getByName(name: string): Promise<Preset | null> {
		return await service.getByName(name);
	},

	async create(data: CreatePresetRequest): Promise<Preset> {
		return await service.create(data);
	},

	async update(id: number, data: UpdatePresetRequest): Promise<Preset> {
		return await service.update(id, data);
	},

	async delete(id: number): Promise<void> {
		await service.delete(id);
	},
};
