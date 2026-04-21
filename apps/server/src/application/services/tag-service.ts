import { createTagService } from "@solid-imager/application/services/tag-service";
import type {
	NewTag,
	Tag,
	TagRepository,
} from "@solid-imager/core/domain/repositories/tag-repository";
import type { UpdateTag } from "@solid-imager/core/domain/tags/schemas";
import { DrizzleTagRepository } from "~/infrastructure/repositories/tag-repository";

// Initialize repository
const tagRepo: TagRepository = new DrizzleTagRepository();
const tagService = createTagService(tagRepo);

const getTagById = async (id: string): Promise<Tag | undefined> => {
	const result = await tagService.getTagById(id);
	return result ?? undefined;
};

const deleteTag = async (id: string): Promise<{ success: true }> => {
	await tagService.deleteTag(id);
	return { success: true };
};

export const TagService = {
	getAllTags: tagService.getAllTags,
	createTag: async (data: NewTag): Promise<Tag> =>
		await tagService.createTag(data),
	getTagById,
	updateTag: async (id: string, data: UpdateTag): Promise<Tag> =>
		await tagService.updateTag(id, data),
	deleteTag,
};
