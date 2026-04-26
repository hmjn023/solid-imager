import { ResourceConflictError, ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	CreatePresetRequest,
	Preset,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";

export type PresetService = ReturnType<typeof createPresetService>;

export function createPresetService(repository: PresetRepository) {
	return {
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

		async create(input: CreatePresetRequest): Promise<Preset> {
			const existing = await repository.getByName(input.name);
			if (existing) {
				throw new ResourceConflictError(`Preset with name "${input.name}" already exists`);
			}
			return await repository.create(input);
		},

		async update(id: number, input: UpdatePresetRequest): Promise<Preset> {
			await this.get(id);

			if (input.name) {
				const existing = await repository.getByName(input.name);
				if (existing && existing.id !== id) {
					throw new ResourceConflictError(`Preset with name "${input.name}" already exists`);
				}
			}

			const updated = await repository.update(id, input);
			if (!updated) {
				throw new ResourceNotFoundError("Preset", String(id));
			}
			return updated;
		},

		async delete(id: number): Promise<void> {
			const deleted = await repository.delete(id);
			if (!deleted) {
				throw new ResourceNotFoundError("Preset", String(id));
			}
		},
	};
}
