import type {
	NewTag,
	TagResponse,
	UpdateTag,
} from "@solid-imager/core/domain/tags/schemas";
import { TauriTagRepository } from "../repositories/tag-repository";

export const TauriTagService = {
	async list(): Promise<TagResponse[]> {
		return await TauriTagRepository.findAll();
	},

	async get(id: string): Promise<TagResponse | null> {
		return await TauriTagRepository.findById(id);
	},

	async create(input: NewTag): Promise<TagResponse> {
		return await TauriTagRepository.create(input);
	},

	async update(id: string, input: UpdateTag): Promise<TagResponse> {
		return await TauriTagRepository.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await TauriTagRepository.delete(id);
	},
};
