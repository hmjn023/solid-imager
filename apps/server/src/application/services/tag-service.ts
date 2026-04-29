import { createTagService } from "@solid-imager/application/services/tag-service";
import type {
	Tag,
	TagRepository,
} from "@solid-imager/core/domain/repositories/tag-repository";
import { DrizzleTagRepository } from "~/infrastructure/repositories/tag-repository";

// Initialize repository
const tagRepo: TagRepository = new DrizzleTagRepository();
const tagService = createTagService(tagRepo);

const getTagById = async (id: string): Promise<Tag | undefined> => {
	const result = await tagService.get(id);
	return result ?? undefined;
};

const deleteTag = async (id: string): Promise<{ success: true }> => {
	await tagService.delete(id);
	return { success: true };
};

export const TagService = {
	list: tagService.list,
	create: tagService.create,
	get: getTagById,
	update: tagService.update,
	delete: deleteTag,
};
