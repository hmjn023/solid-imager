import type {
	NewTag,
	TagRepository,
} from "@solid-imager/core/domain/repositories/tag-repository";
import type { UpdateTag } from "@solid-imager/core/domain/tags/schemas";
import type { ITagService } from "../ports/tag-service";

export function createTagService(repo: TagRepository): ITagService {
	return {
		getAllTags: () => repo.findAll(),
		getTagById: async (id) => {
			const result = await repo.findById(id);
			return result ?? undefined;
		},
		createTag: (data: NewTag) => repo.create(data),
		updateTag: (id: string, data: UpdateTag) => repo.update(id, data),
		deleteTag: async (id: string) => {
			await repo.delete(id);
			return { success: true as const };
		},
	};
}
