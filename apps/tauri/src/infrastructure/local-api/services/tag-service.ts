import { createTagService } from "@solid-imager/application/services/tag-service";
import type { Tag } from "@solid-imager/core/domain/repositories/tag-repository";
import type { NewTag, UpdateTag } from "@solid-imager/core/domain/tags/schemas";
import { TauriTagRepository } from "../repositories/tag-repository";

const tagService = createTagService(TauriTagRepository);

export const TauriTagService = {
	async list(): Promise<Tag[]> {
		return await tagService.list();
	},

	async get(id: string): Promise<Tag | null> {
		return await tagService.get(id);
	},

	async create(input: NewTag): Promise<Tag> {
		return await tagService.create(input);
	},

	async update(id: string, input: UpdateTag): Promise<Tag> {
		return await tagService.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await tagService.delete(id);
	},
};
