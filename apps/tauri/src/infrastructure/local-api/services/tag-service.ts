import { createTagService } from "@solid-imager/application/services/tag-service";
import type {
	NewTag,
	TagResponse,
	UpdateTag,
} from "@solid-imager/core/domain/tags/schemas";
import { TauriTagRepository } from "../repositories/tag-repository";

const tagService = createTagService(TauriTagRepository);

export const TauriTagService = {
	async list(): Promise<TagResponse[]> {
		return await tagService.getAllTags();
	},

	async get(id: string): Promise<TagResponse | null> {
		return await tagService.getTagById(id);
	},

	async create(input: NewTag): Promise<TagResponse> {
		return await tagService.createTag(input);
	},

	async update(id: string, input: UpdateTag): Promise<TagResponse> {
		return await tagService.updateTag(id, input);
	},

	async delete(id: string): Promise<void> {
		await tagService.deleteTag(id);
	},
};
