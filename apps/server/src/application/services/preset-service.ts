import { ResourceConflictError, ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	CreatePresetRequest,
	Preset,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { DrizzlePresetRepository } from "~/infrastructure/repositories/preset-repository";

let repository: PresetRepository = new DrizzlePresetRepository();

// For testing IDI (dependency injection)
export const setPresetRepository = (repo: PresetRepository) => {
	repository = repo;
};

export const PresetService = {
	async list(): Promise<Preset[]> {
		return await repository.list();
	},

	async get(id: number): Promise<Preset> {
		const preset = await repository.get(id);
		if (!preset) {
			throw new ResourceNotFoundError("Preset", String(id));
		}
		return preset;
	},

	async getByName(name: string): Promise<Preset | null> {
		return await repository.getByName(name);
	},

	async create(data: CreatePresetRequest): Promise<Preset> {
		const existing = await repository.getByName(data.name);
		if (existing) {
			throw new ResourceConflictError(`Preset with name "${data.name}" already exists`);
		}
		return repository.create(data);
	},

	async update(id: number, data: UpdatePresetRequest): Promise<Preset> {
		// Check existence
		await PresetService.get(id);

		// Check name conflict if updating name
		if (data.name) {
			const existing = await repository.getByName(data.name);
			if (existing && existing.id !== id) {
				throw new ResourceConflictError(`Preset with name "${data.name}" already exists`);
			}
		}

		const updated = await repository.update(id, data);
		if (!updated) {
			throw new ResourceNotFoundError("Preset", String(id));
		}
		return updated;
	},

	async delete(id: number): Promise<void> {
		const success = await repository.delete(id);
		if (!success) {
			throw new ResourceNotFoundError("Preset", String(id));
		}
	},
};
