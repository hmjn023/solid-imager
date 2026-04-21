import { createPresetService } from "@solid-imager/application/services/preset-service";
import type {
	CreatePresetRequest,
	Preset,
	UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";
import { TauriPresetRepository } from "../repositories/preset-repository";

const presetService = createPresetService(TauriPresetRepository);

export const TauriPresetService = {
	async list(): Promise<Preset[]> {
		return await presetService.list();
	},

	async get(id: number): Promise<Preset> {
		return await presetService.get(id);
	},

	async getByName(name: string): Promise<Preset | null> {
		return await presetService.getByName(name);
	},

	async create(input: CreatePresetRequest): Promise<Preset> {
		return await presetService.create(input);
	},

	async update(id: number, input: UpdatePresetRequest): Promise<Preset> {
		return await presetService.update(id, input);
	},

	async delete(id: number): Promise<void> {
		await presetService.delete(id);
	},
};
