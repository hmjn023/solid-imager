import type { NewTag, Tag, UpdateTag } from "@solid-imager/core/tags";

/** Manages tags and looks them up by ID. */
export interface ITagService {
	getAllTags(): Promise<Tag[]>;
	getTagById(id: string): Promise<Tag | undefined>;
	createTag(data: NewTag): Promise<Tag>;
	updateTag(id: string, data: UpdateTag): Promise<Tag>;
	deleteTag(id: string): Promise<{ success: true }>;
}
