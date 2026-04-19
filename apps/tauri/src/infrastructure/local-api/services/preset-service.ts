import { ResourceConflictError, ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	CreatePresetRequest,
	Preset,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import { TauriPresetRepository } from "../repositories/preset-repository";

export const TauriPresetService = {
	async list(): Promise<Preset[]> {
		return await TauriPresetRepository.list();
	},

	async get(id: number): Promise<Preset> {
		const preset = await TauriPresetRepository.get(id);
		if (!preset) {
			throw new ResourceNotFoundError("Preset", String(id));
		}
		return preset;
	},

	async getByName(name: string): Promise<Preset | null> {
		return await TauriPresetRepository.getByName(name);
	},

	async create(input: CreatePresetRequest): Promise<Preset> {
		const existing = await TauriPresetRepository.getByName(input.name);
		if (existing) {
			throw new ResourceConflictError(`Preset with name "${input.name}" already exists`);
		}
		return await TauriPresetRepository.create(input);
	},

	async update(id: number, input: UpdatePresetRequest): Promise<Preset> {
		const current = await TauriPresetRepository.get(id);
		if (!current) {
			throw new ResourceNotFoundError("Preset", String(id));
		}

		if (input.name) {
			const existing = await TauriPresetRepository.getByName(input.name);
			if (existing && existing.id !== id) {
				throw new ResourceConflictError(`Preset with name "${input.name}" already exists`);
			}
		}

		const updated = await TauriPresetRepository.update(id, input);
		if (!updated) {
			throw new ResourceNotFoundError("Preset", String(id));
		}
		return updated;
	},

	async delete(id: number): Promise<void> {
		const deleted = await TauriPresetRepository.delete(id);
		if (!deleted) {
			throw new ResourceNotFoundError("Preset", String(id));
		}
	},
};
