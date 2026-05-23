import type {
  NewTag,
  Tag,
  TagRepository,
} from "@solid-imager/core/domain/repositories/tag-repository";
import type { UpdateTag } from "@solid-imager/core/domain/tags/schemas";

export interface ITagService {
  getAllTags(): Promise<Tag[]>;
  createTag(data: NewTag): Promise<Tag>;
  updateTag(id: string, data: UpdateTag): Promise<Tag>;
  deleteTag(id: string): Promise<{ success: true }>;
}
