import type { MediaTag } from "@solid-imager/core/domain/media/schemas";
import type {
	NewTag,
	Tag,
	TagRepository,
} from "@solid-imager/core/domain/repositories/tag-repository";
import type { UpdateTag } from "@solid-imager/core/domain/tags/schemas";

export type TagsToAdd = {
	name: string;
	type: "positive" | "negative";
	confidence?: number;
}[];

export type TagService = ReturnType<typeof createTagService>;

export function createTagService(repository: TagRepository) {
	return {
		async getAllTags(): Promise<Tag[]> {
			return await repository.findAll();
		},

		async getTagById(id: string): Promise<Tag | null> {
			return await repository.findById(id);
		},

		async createTag(input: NewTag): Promise<Tag> {
			return await repository.create(input);
		},

		async updateTag(id: string, input: UpdateTag): Promise<Tag> {
			return await repository.update(id, input);
		},

		async deleteTag(id: string): Promise<void> {
			await repository.delete(id);
		},

		async getTagsForMedia(mediaId: string): Promise<MediaTag[]> {
			return await repository.findByMediaId(mediaId);
		},

		async addTagsToMedia(mediaId: string, tags: TagsToAdd, source = "manual"): Promise<void> {
			await repository.addTagsToMedia(mediaId, tags, source);
		},
	};
}
